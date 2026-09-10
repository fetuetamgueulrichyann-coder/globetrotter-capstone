"""
Temps réel : chaque utilisateur connecté rejoint une room privée
"user:<id>" dès l'authentification du socket. Quand un message est créé
(toujours via la route REST POST /conversations/:id/messages, voir
conversations.py), on l'émet dans les rooms des deux participants.

Authentification du socket : le JWT vit dans un cookie httpOnly (jamais lisible
depuis le JavaScript du frontend, volontairement, contre le vol XSS — voir
lib/api.ts). La connexion WebSocket démarre toujours par une requête HTTP de
handshake, sur laquelle le cookie est bien présent : on le lit exactement
comme auth_middleware.py le fait pour les routes REST classiques. Le client
se contente de se connecter avec `withCredentials: true`.

--- Appels audio/vidéo (WebRTC) ---
Le serveur ne voit jamais le flux audio/vidéo lui-même (il circule en pair-à-
pair entre les deux navigateurs une fois la connexion établie) : il se
contente de relayer les messages de signalisation (offre/réponse SDP,
candidats ICE) entre l'appelant et l'appelé, exactement comme un standard
téléphonique qui met en relation sans écouter la conversation. Limité aux
conversations directes (1 à 1) pour l'instant — pas d'appel de groupe.
"""
import uuid
from datetime import datetime, timezone

import jwt as pyjwt
from flask import request
from flask_socketio import SocketIO, join_room, disconnect

from app.config import Config
from app import logger

socketio = SocketIO(cors_allowed_origins=Config.CORS_ORIGINS, async_mode="eventlet")

# uid -> nombre d'onglets/connexions actives (permet de savoir qui est "en ligne")
_online_counts = {}

# callId -> {conversationId, callerId, calleeId, kind, status, startedAt}
# En mémoire seulement : un appel ne survit pas à un redémarrage du service,
# ce qui est acceptable (un appel en cours serait de toute façon coupé par un
# redémarrage du conteneur, WebRTC ou pas).
_active_calls = {}


def _extract_token_from_handshake():
    token = request.cookies.get(Config.COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    return token


def _verify_token(token):
    try:
        decoded = pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        return decoded["sub"]
    except pyjwt.PyJWTError:
        return None


GENERAL_GROUP_ROOM = "group:general"


@socketio.on("connect")
def handle_connect(auth):
    token = _extract_token_from_handshake()
    user_id = _verify_token(token) if token else None
    if not user_id:
        logger.warn("Connexion socket refusée (cookie de session invalide/absent)")
        disconnect()
        return False
    join_room(f"user:{user_id}")
    join_room(GENERAL_GROUP_ROOM)  # le groupe général est ouvert à tous les utilisateurs connectés
    _online_counts[user_id] = _online_counts.get(user_id, 0) + 1
    request.sid_user_id = user_id  # pour le disconnect
    logger.info("Socket connecté", userId=user_id)


@socketio.on("disconnect")
def handle_disconnect():
    user_id = getattr(request, "sid_user_id", None)
    if user_id and user_id in _online_counts:
        _online_counts[user_id] = max(0, _online_counts[user_id] - 1)
    if user_id:
        # Coupe proprement tout appel en cours si l'un des deux perd sa connexion.
        stale_call_ids = [
            cid for cid, c in _active_calls.items() if user_id in (c["callerId"], c["calleeId"])
        ]
        for cid in stale_call_ids:
            call = _active_calls.get(cid)
            status = "completed" if call and call.get("startedAt") else "missed"
            _end_call(cid, user_id, status)


def broadcast_message(conversation_id, message, recipient_ids, event="new_message"):
    for uid in set(recipient_ids):
        socketio.emit(
            event,
            {"conversationId": conversation_id, "message": message},
            room=f"user:{uid}",
        )


def broadcast_group_message(conversation_id, message, event="new_message"):
    socketio.emit(
        event,
        {"conversationId": conversation_id, "message": message},
        room=GENERAL_GROUP_ROOM,
    )


@socketio.on("typing")
def handle_typing(data):
    """
    Relaie un indicateur "en train d'écrire" à l'autre participant d'une
    conversation. Purement éphémère (rien n'est stocké en base) : si le
    destinataire n'est pas connecté à l'instant T, l'événement est
    simplement perdu, ce qui est le comportement attendu pour ce genre
    d'indicateur.
    """
    user_id = getattr(request, "sid_user_id", None)
    if not user_id:
        return
    conversation_id = (data or {}).get("conversationId")
    recipient_id = (data or {}).get("recipientId")
    if not conversation_id or not recipient_id:
        return
    socketio.emit(
        "user_typing",
        {"conversationId": conversation_id, "userId": user_id},
        room=f"user:{recipient_id}",
    )


# ==================== Appels audio/vidéo (WebRTC) ====================

def _other_party(call):
    def _inner(user_id):
        return call["calleeId"] if user_id == call["callerId"] else call["callerId"]
    return _inner


def _end_call(call_id, ended_by, status):
    """
    Termine un appel (raccroché, refusé, manqué...), prévient l'autre partie
    et enregistre une trace dans l'historique de la conversation — comme un
    message classique, pour que ça apparaisse dans le fil de discussion.
    """
    from app import models  # import local : évite tout risque de cycle au chargement du module

    call = _active_calls.pop(call_id, None)
    if not call:
        return

    duration = 0
    if call.get("startedAt"):
        duration = (datetime.now(timezone.utc) - call["startedAt"]).total_seconds()

    other_id = _other_party(call)(ended_by) if ended_by else call["calleeId"]
    socketio.emit("call:ended", {"callId": call_id, "status": status}, room=f"user:{other_id}")

    message = models.create_call_message(
        call["conversationId"], call["callerId"], call["kind"], status, duration_seconds=duration,
    )
    conv = models.get_conversation(call["conversationId"])
    from app.conversations import _broadcast
    _broadcast(conv, message, call["callerId"])


@socketio.on("call:invite")
def handle_call_invite(data):
    """
    Démarre un appel. Le destinataire n'est jamais fourni par le client : il
    est déduit côté serveur à partir de la conversation, pour ne jamais
    permettre d'appeler quelqu'un en dehors d'une conversation existante.
    """
    from app import models

    user_id = getattr(request, "sid_user_id", None)
    if not user_id:
        return
    conversation_id = (data or {}).get("conversationId")
    kind = (data or {}).get("kind")
    if kind not in ("audio", "video") or not conversation_id:
        return

    conv = models.get_conversation(conversation_id)
    if not conv or conv["type"] != "direct" or user_id not in (conv["userAId"], conv["userBId"]):
        socketio.emit("call:error", {"message": "Conversation introuvable"}, room=f"user:{user_id}")
        return

    callee_id = conv["userBId"] if conv["userAId"] == user_id else conv["userAId"]

    # Une personne déjà en ligne (peu importe avec qui) est considérée occupée.
    if any(c["calleeId"] == callee_id or c["callerId"] == callee_id for c in _active_calls.values()):
        socketio.emit("call:busy", {"conversationId": conversation_id}, room=f"user:{user_id}")
        return

    call_id = str(uuid.uuid4())
    _active_calls[call_id] = {
        "conversationId": conversation_id, "callerId": user_id, "calleeId": callee_id,
        "kind": kind, "startedAt": None,
    }
    socketio.emit(
        "call:incoming",
        {"callId": call_id, "conversationId": conversation_id, "kind": kind, "callerId": user_id},
        room=f"user:{callee_id}",
    )
    socketio.emit("call:ringing", {"callId": call_id}, room=f"user:{user_id}")


@socketio.on("call:accept")
def handle_call_accept(data):
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    call = _active_calls.get(call_id)
    if not call or user_id != call["calleeId"]:
        return
    call["startedAt"] = datetime.now(timezone.utc)
    socketio.emit("call:accepted", {"callId": call_id}, room=f"user:{call['callerId']}")


@socketio.on("call:decline")
def handle_call_decline(data):
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    call = _active_calls.get(call_id)
    if not call or user_id != call["calleeId"]:
        return
    _end_call(call_id, user_id, "declined")


@socketio.on("call:cancel")
def handle_call_cancel(data):
    """L'appelant raccroche avant que l'appelé n'ait répondu."""
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    call = _active_calls.get(call_id)
    if not call or user_id != call["callerId"]:
        return
    _end_call(call_id, user_id, "missed")


@socketio.on("call:end")
def handle_call_end(data):
    """Raccroche un appel en cours, côté appelant ou appelé."""
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    call = _active_calls.get(call_id)
    if not call or user_id not in (call["callerId"], call["calleeId"]):
        return
    status = "completed" if call.get("startedAt") else "missed"
    _end_call(call_id, user_id, status)


@socketio.on("call:offer")
def handle_call_offer(data):
    """Relaie l'offre SDP de l'appelant vers l'appelé, sans y toucher."""
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    sdp = (data or {}).get("sdp")
    call = _active_calls.get(call_id)
    if not call or user_id != call["callerId"] or not sdp:
        return
    socketio.emit("call:offer", {"callId": call_id, "sdp": sdp}, room=f"user:{call['calleeId']}")


@socketio.on("call:answer")
def handle_call_answer(data):
    """Relaie la réponse SDP de l'appelé vers l'appelant, sans y toucher."""
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    sdp = (data or {}).get("sdp")
    call = _active_calls.get(call_id)
    if not call or user_id != call["calleeId"] or not sdp:
        return
    socketio.emit("call:answer", {"callId": call_id, "sdp": sdp}, room=f"user:{call['callerId']}")


@socketio.on("call:ice")
def handle_call_ice(data):
    """Relaie un candidat ICE vers l'autre partie de l'appel."""
    user_id = getattr(request, "sid_user_id", None)
    call_id = (data or {}).get("callId")
    candidate = (data or {}).get("candidate")
    call = _active_calls.get(call_id)
    if not call or user_id not in (call["callerId"], call["calleeId"]) or not candidate:
        return
    target = _other_party(call)(user_id)
    socketio.emit("call:ice", {"callId": call_id, "candidate": candidate}, room=f"user:{target}")
