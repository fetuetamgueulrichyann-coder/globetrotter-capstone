"""
Endpoints REST de la messagerie : liste des conversations, historique des
messages, démarrage d'une conversation, envoi d'un message, suppression.

L'envoi passe systématiquement par cette route (pas uniquement par le socket)
pour que le message soit persisté même si l'expéditeur ou le destinataire
n'a pas de connexion WebSocket active au même instant — le temps réel est un
bonus de livraison instantanée, jamais le seul chemin d'écriture.
"""
from flask import Blueprint, request, jsonify, g, send_from_directory

from app import models
from app.auth_middleware import requires_auth
from app.errors import ApiError
from app.clients import get_user_identity, get_user_identities, get_messaging_privacy
from app.config import Config
from app.db import GENERAL_GROUP_ID
from app.validators import save_voice_message, AudioRejected

conversations_bp = Blueprint("conversations", __name__, url_prefix="/conversations")


def _broadcast(conv, message, sender_id, event="new_message"):
    """Diffuse un message (ou sa suppression) aux bons destinataires selon le type de conversation."""
    from app.sockets import broadcast_message, broadcast_group_message
    if conv["type"] == "group":
        if conv["id"] == GENERAL_GROUP_ID:
            broadcast_group_message(conv["id"], message, event=event)
        else:
            member_ids = models.list_group_member_ids(conv["id"])
            broadcast_message(conv["id"], message, recipient_ids=member_ids, event=event)
    else:
        other_id = conv["userBId"] if conv["userAId"] == sender_id else conv["userAId"]
        broadcast_message(conv["id"], message, recipient_ids=[sender_id, other_id], event=event)


@conversations_bp.get("")
@requires_auth
def list_my_conversations():
    convs = models.list_conversations_for_user(g.user["id"])
    other_ids = [c["otherUserId"] for c in convs if c["otherUserId"]]
    identities = {uid: get_user_identity(uid) for uid in set(other_ids)}
    data = [
        {
            **c,
            "otherUser": identities.get(c["otherUserId"]) if c["otherUserId"] else None,
        }
        for c in convs
    ]
    return jsonify({"success": True, "data": data}), 200


@conversations_bp.post("/groups")
@requires_auth
def create_group():
    """
    Crée un groupe personnalisé. body: { title, memberIds: [] }
    Le créateur choisit qui ajouter parmi les utilisateurs de l'app (par nom,
    via la recherche existante) — pas d'ajout à l'aveugle par email/téléphone.
    """
    body = request.get_json(force=True, silent=True) or {}
    title = (body.get("title") or "").strip()
    member_ids = [m for m in (body.get("memberIds") or []) if isinstance(m, str) and m != g.user["id"]]

    if not (2 <= len(title) <= 100):
        raise ApiError(422, "Le nom du groupe doit contenir entre 2 et 100 caractères")
    if not member_ids:
        raise ApiError(422, "Ajoute au moins une personne au groupe")

    conv = models.create_group(g.user["id"], title, member_ids)
    return jsonify({"success": True, "data": conv}), 201


@conversations_bp.get("/<conversation_id>/members")
@requires_auth
def list_members(conversation_id):
    conv = models.get_conversation(conversation_id)
    if not conv or conv["type"] != "group" or conv["id"] == GENERAL_GROUP_ID:
        raise ApiError(404, "Groupe introuvable")
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Groupe introuvable")
    member_ids = models.list_group_member_ids(conversation_id)
    identities = get_user_identities(member_ids)
    members = [identities[uid] for uid in member_ids if uid in identities]
    return jsonify({"success": True, "data": {"members": members, "ownerId": conv["ownerId"]}}), 200


@conversations_bp.post("/<conversation_id>/members")
@requires_auth
def add_member(conversation_id):
    conv = models.get_conversation(conversation_id)
    if not conv or conv["type"] != "group" or conv["id"] == GENERAL_GROUP_ID:
        raise ApiError(404, "Groupe introuvable")
    if conv["ownerId"] != g.user["id"]:
        raise ApiError(403, "Seul le créateur du groupe peut ajouter des membres")
    body = request.get_json(force=True, silent=True) or {}
    target_id = (body.get("userId") or "").strip()
    if not target_id:
        raise ApiError(422, "userId requis")
    models.add_group_member(conversation_id, target_id)
    return jsonify({"success": True}), 200


@conversations_bp.post("/<conversation_id>/leave")
@requires_auth
def leave_group(conversation_id):
    """
    Quitter un groupe personnalisé — libre à tout moment, pour n'importe quel
    membre y compris le créateur. Le groupe général ne peut pas être quitté.
    """
    conv = models.get_conversation(conversation_id)
    if not conv or conv["type"] != "group" or conv["id"] == GENERAL_GROUP_ID:
        raise ApiError(422, "Ce groupe ne peut pas être quitté")
    ok = models.remove_group_member(conversation_id, g.user["id"])
    if not ok:
        raise ApiError(404, "Tu ne fais pas partie de ce groupe")
    return jsonify({"success": True}), 200


@conversations_bp.post("")
@requires_auth
def start_conversation():
    body = request.get_json(force=True, silent=True) or {}
    target_id = (body.get("targetUserId") or "").strip()
    if not target_id:
        raise ApiError(422, "targetUserId requis")
    if target_id == g.user["id"]:
        raise ApiError(422, "Impossible de s'écrire à soi-même")
    if not models.direct_conversation_exists(g.user["id"], target_id):
        # Nouvelle conversation : on respecte la confidentialité de la
        # personne visée. Une conversation déjà existante n'est jamais
        # bloquée rétroactivement par ce réglage.
        if get_messaging_privacy(target_id) == "nobody":
            raise ApiError(403, "Cette personne n'accepte pas de nouveaux messages")
    conv = models.get_or_create_conversation(g.user["id"], target_id)
    other = get_user_identity(target_id)
    return jsonify({"success": True, "data": {**conv, "otherUser": other}}), 201


@conversations_bp.get("/<conversation_id>/messages")
@requires_auth
def get_messages(conversation_id):
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Conversation introuvable")
    before = request.args.get("before")
    messages = models.list_messages(conversation_id, before=before)
    models.mark_conversation_read(conversation_id, g.user["id"])

    # Résout le nom de profil de chaque expéditeur — utile pour le groupe
    # général où plusieurs personnes différentes écrivent dans le même fil.
    sender_ids = {m["senderId"] for m in messages}
    identities = get_user_identities(sender_ids)
    data = [{**m, "sender": identities.get(m["senderId"])} for m in messages]
    return jsonify({"success": True, "data": data}), 200


@conversations_bp.post("/<conversation_id>/messages")
@requires_auth
def post_message(conversation_id):
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Conversation introuvable")
    body = request.get_json(force=True, silent=True) or {}
    content = (body.get("content") or "").strip()
    if not content:
        raise ApiError(422, "Le message ne peut pas être vide")
    if len(content) > Config.MAX_MESSAGE_LENGTH:
        raise ApiError(422, f"Message trop long (max {Config.MAX_MESSAGE_LENGTH} caractères)")

    message = models.create_message(conversation_id, g.user["id"], content)
    message["sender"] = get_user_identity(g.user["id"])

    # Diffusion temps réel si des sockets sont connectés. Ne bloque jamais la
    # réponse HTTP : le message est déjà en base.
    conv = models.get_conversation(conversation_id)
    _broadcast(conv, message, g.user["id"])

    return jsonify({"success": True, "data": message}), 201


@conversations_bp.post("/<conversation_id>/voice-messages")
@requires_auth
def post_voice_message(conversation_id):
    """
    Envoi d'un message vocal — multipart/form-data avec un champ "audio" et,
    optionnellement, "durationSeconds". Fonctionne pour une conversation
    privée, le groupe général, ou un groupe personnalisé.
    """
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Conversation introuvable")

    audio_file = request.files.get("audio")
    if not audio_file or not audio_file.filename:
        raise ApiError(422, "Fichier audio requis")

    duration = request.form.get("durationSeconds", "0")
    try:
        duration = min(float(duration), Config.MAX_VOICE_MESSAGE_SECONDS)
    except ValueError:
        duration = 0

    try:
        audio_url = save_voice_message(audio_file)
    except AudioRejected as e:
        raise ApiError(422, e.message)

    message = models.create_voice_message(conversation_id, g.user["id"], audio_url, duration)
    message["sender"] = get_user_identity(g.user["id"])

    conv = models.get_conversation(conversation_id)
    _broadcast(conv, message, g.user["id"])

    return jsonify({"success": True, "data": message}), 201


@conversations_bp.get("/voice-uploads/<path:filename>")
def serve_voice_message(filename):
    """Sert les fichiers audio enregistrés — accessible uniquement avec le nom généré côté serveur (non énumérable)."""
    return send_from_directory(Config.UPLOADS_DIR, filename)


@conversations_bp.delete("/<conversation_id>")
@requires_auth
def delete_conversation(conversation_id):
    """Supprime la conversation de la liste de l'utilisateur courant (ou fait quitter un groupe personnalisé)."""
    if conversation_id == GENERAL_GROUP_ID:
        raise ApiError(422, "Le groupe général ne peut pas être supprimé")
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Conversation introuvable")
    models.delete_conversation_for_user(conversation_id, g.user["id"])
    return jsonify({"success": True}), 200


@conversations_bp.delete("/<conversation_id>/messages/<message_id>")
@requires_auth
def delete_message(conversation_id, message_id):
    """Supprime un message (auteur uniquement, ou un administrateur)."""
    if not models.is_participant(conversation_id, g.user["id"]):
        raise ApiError(404, "Conversation introuvable")
    is_admin = g.user.get("role") == "admin"
    result = models.delete_message(message_id, g.user["id"], is_admin=is_admin)
    if result is None:
        raise ApiError(404, "Message introuvable")
    if result is False:
        raise ApiError(403, "Vous ne pouvez supprimer que vos propres messages")

    conv = models.get_conversation(conversation_id)
    _broadcast(conv, result, g.user["id"], event="message_deleted")

    return jsonify({"success": True, "data": result}), 200
