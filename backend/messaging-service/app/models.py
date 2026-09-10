"""Couche de données du Messaging Service."""
import json
from datetime import datetime, timezone
from sqlalchemy import or_
from app.db import get_session, GENERAL_GROUP_ID
from app.db_models import ConversationRow, MessageRow, ConversationParticipantRow


def _pair(user_id_1, user_id_2):
    """Ordonne toujours la paire de la même façon (voir commentaire ConversationRow)."""
    return tuple(sorted([user_id_1, user_id_2]))


def _deleted_list(row):
    if not row.deleted_for:
        return []
    try:
        return json.loads(row.deleted_for)
    except (TypeError, ValueError):
        return []


def _conversation_to_dict(row):
    return {
        "id": row.id,
        "type": row.type or "direct",
        "title": row.title,
        "ownerId": row.owner_id,
        "userAId": row.user_a_id,
        "userBId": row.user_b_id,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "lastMessageAt": row.last_message_at.isoformat() if row.last_message_at else None,
    }


def _message_to_dict(row):
    deleted = row.deleted == "true"
    return {
        "id": row.id,
        "conversationId": row.conversation_id,
        "senderId": row.sender_id,
        "type": row.type or "text",
        "content": "Message supprimé" if deleted else row.content,
        "audioUrl": None if deleted else row.audio_url,
        "durationSeconds": int(row.duration_seconds) if row.duration_seconds else None,
        "callKind": row.call_kind,
        "callStatus": row.call_status,
        "deleted": deleted,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "readAt": row.read_at.isoformat() if row.read_at else None,
    }


def _is_custom_group_member(s, conversation_id, user_id):
    return (
        s.query(ConversationParticipantRow)
        .filter_by(conversation_id=conversation_id, user_id=user_id)
        .first()
        is not None
    )


def direct_conversation_exists(user_id_1, user_id_2):
    """Utilisé pour ne pas bloquer une conversation déjà en cours à cause d'un changement de confidentialité ultérieur."""
    a, b = _pair(user_id_1, user_id_2)
    with get_session() as s:
        return s.query(ConversationRow).filter_by(user_a_id=a, user_b_id=b).first() is not None


def get_or_create_conversation(user_id_1, user_id_2):
    a, b = _pair(user_id_1, user_id_2)
    with get_session() as s:
        row = s.query(ConversationRow).filter_by(user_a_id=a, user_b_id=b).first()
        if not row:
            row = ConversationRow(user_a_id=a, user_b_id=b, type="direct")
            s.add(row)
            s.flush()
        elif row.deleted_for:
            # Si l'un des deux avait supprimé la conversation, le fait d'en
            # redémarrer une la fait réapparaître dans sa liste.
            remaining = [uid for uid in _deleted_list(row) if uid not in (user_id_1, user_id_2)]
            row.deleted_for = json.dumps(remaining) if remaining else None
        return _conversation_to_dict(row)


def create_group(owner_id, title, member_ids):
    """
    Crée un groupe personnalisé. Le créateur est toujours membre. Les
    doublons dans member_ids sont ignorés silencieusement.
    """
    with get_session() as s:
        conv = ConversationRow(type="group", title=title.strip()[:100], owner_id=owner_id)
        s.add(conv)
        s.flush()
        all_members = {owner_id, *member_ids}
        for uid in all_members:
            s.add(ConversationParticipantRow(conversation_id=conv.id, user_id=uid))
        s.flush()
        return _conversation_to_dict(conv)


def list_group_member_ids(conversation_id):
    with get_session() as s:
        rows = s.query(ConversationParticipantRow).filter_by(conversation_id=conversation_id).all()
        return [r.user_id for r in rows]


def add_group_member(conversation_id, user_id):
    with get_session() as s:
        conv = s.get(ConversationRow, conversation_id)
        if not conv or conv.type != "group" or conv.id == GENERAL_GROUP_ID:
            return False
        if not _is_custom_group_member(s, conversation_id, user_id):
            s.add(ConversationParticipantRow(conversation_id=conversation_id, user_id=user_id))
        return True


def remove_group_member(conversation_id, user_id):
    """Utilisé à la fois pour "quitter le groupe" et pour le retrait par le créateur."""
    with get_session() as s:
        row = (
            s.query(ConversationParticipantRow)
            .filter_by(conversation_id=conversation_id, user_id=user_id)
            .first()
        )
        if not row:
            return False
        s.delete(row)
        return True


def list_conversations_for_user(user_id):
    with get_session() as s:
        custom_group_ids = [
            r.conversation_id
            for r in s.query(ConversationParticipantRow).filter_by(user_id=user_id).all()
        ]
        filters = [
            ConversationRow.user_a_id == user_id,
            ConversationRow.user_b_id == user_id,
            ConversationRow.id == GENERAL_GROUP_ID,
        ]
        if custom_group_ids:
            filters.append(ConversationRow.id.in_(custom_group_ids))

        rows = (
            s.query(ConversationRow)
            .filter(or_(*filters))
            .order_by(ConversationRow.last_message_at.desc())
            .all()
        )
        result = []
        for row in rows:
            if user_id in _deleted_list(row):
                continue
            last = (
                s.query(MessageRow)
                .filter_by(conversation_id=row.id)
                .order_by(MessageRow.created_at.desc())
                .first()
            )
            unread = (
                s.query(MessageRow)
                .filter(
                    MessageRow.conversation_id == row.id,
                    MessageRow.sender_id != user_id,
                    MessageRow.read_at.is_(None),
                )
                .count()
            )
            other_user_id = None
            member_count = None
            if row.type != "group":
                other_user_id = row.user_b_id if row.user_a_id == user_id else row.user_a_id
            elif row.id != GENERAL_GROUP_ID:
                member_count = s.query(ConversationParticipantRow).filter_by(conversation_id=row.id).count()
            result.append({
                **_conversation_to_dict(row),
                "otherUserId": other_user_id,
                "memberCount": member_count,
                "lastMessage": _message_to_dict(last) if last else None,
                "unreadCount": unread,
            })
        return result


def get_conversation(conversation_id):
    with get_session() as s:
        row = s.get(ConversationRow, conversation_id)
        return _conversation_to_dict(row) if row else None


def is_participant(conversation_id, user_id):
    with get_session() as s:
        row = s.get(ConversationRow, conversation_id)
        if not row:
            return False
        if row.type == "group":
            if row.id == GENERAL_GROUP_ID:
                return True
            return _is_custom_group_member(s, conversation_id, user_id)
        return user_id in (row.user_a_id, row.user_b_id)


def list_messages(conversation_id, before=None, limit=50):
    with get_session() as s:
        q = s.query(MessageRow).filter_by(conversation_id=conversation_id)
        if before:
            q = q.filter(MessageRow.created_at < before)
        rows = q.order_by(MessageRow.created_at.desc()).limit(limit).all()
        return [_message_to_dict(r) for r in reversed(rows)]


def _touch_conversation(s, conversation_id, sender_id):
    conv = s.get(ConversationRow, conversation_id)
    if conv:
        conv.last_message_at = datetime.now(timezone.utc)
        # Si l'expéditeur avait supprimé cette conversation pour lui, le
        # fait de réécrire la fait réapparaître dans sa propre liste.
        deleted = _deleted_list(conv)
        if sender_id in deleted:
            remaining = [uid for uid in deleted if uid != sender_id]
            conv.deleted_for = json.dumps(remaining) if remaining else None
    return conv


def create_message(conversation_id, sender_id, content):
    with get_session() as s:
        msg = MessageRow(conversation_id=conversation_id, sender_id=sender_id, content=content, type="text")
        s.add(msg)
        _touch_conversation(s, conversation_id, sender_id)
        s.flush()
        return _message_to_dict(msg)


def create_voice_message(conversation_id, sender_id, audio_url, duration_seconds):
    with get_session() as s:
        msg = MessageRow(
            conversation_id=conversation_id, sender_id=sender_id, type="voice",
            content="🎤 Message vocal", audio_url=audio_url, duration_seconds=str(int(duration_seconds or 0)),
        )
        s.add(msg)
        _touch_conversation(s, conversation_id, sender_id)
        s.flush()
        return _message_to_dict(msg)


_CALL_LABELS = {
    ("audio", "completed"): "📞 Appel vocal",
    ("audio", "missed"): "📞 Appel vocal manqué",
    ("audio", "declined"): "📞 Appel vocal refusé",
    ("video", "completed"): "🎥 Appel vidéo",
    ("video", "missed"): "🎥 Appel vidéo manqué",
    ("video", "declined"): "🎥 Appel vidéo refusé",
}


def create_call_message(conversation_id, sender_id, call_kind, call_status, duration_seconds=0):
    """
    Enregistre la trace d'un appel dans l'historique de la conversation
    (comme sur WhatsApp) une fois l'appel terminé, manqué ou refusé. Le
    déroulement en direct de l'appel lui-même passe uniquement par les
    sockets (voir sockets.py) — rien n'est écrit tant que l'appel n'est pas fini.
    """
    label = _CALL_LABELS.get((call_kind, call_status), "📞 Appel")
    with get_session() as s:
        msg = MessageRow(
            conversation_id=conversation_id, sender_id=sender_id, type="call", content=label,
            call_kind=call_kind, call_status=call_status,
            duration_seconds=str(int(duration_seconds or 0)),
        )
        s.add(msg)
        _touch_conversation(s, conversation_id, sender_id)
        s.flush()
        return _message_to_dict(msg)


def mark_conversation_read(conversation_id, reader_id):
    with get_session() as s:
        (
            s.query(MessageRow)
            .filter(
                MessageRow.conversation_id == conversation_id,
                MessageRow.sender_id != reader_id,
                MessageRow.read_at.is_(None),
            )
            .update({MessageRow.read_at: datetime.now(timezone.utc)})
        )


def delete_conversation_for_user(conversation_id, user_id):
    """
    Suppression "pour moi" : la conversation disparaît de la liste de cet
    utilisateur, sans effacer les messages ni impacter l'autre participant.
    Le groupe général ne peut pas être supprimé (il concerne tout le monde).
    Pour un groupe personnalisé, "supprimer" revient à le quitter.
    """
    with get_session() as s:
        row = s.get(ConversationRow, conversation_id)
        if not row or row.id == GENERAL_GROUP_ID:
            return False
        if row.type == "group":
            member = (
                s.query(ConversationParticipantRow)
                .filter_by(conversation_id=conversation_id, user_id=user_id)
                .first()
            )
            if member:
                s.delete(member)
            return True
        deleted = _deleted_list(row)
        if user_id not in deleted:
            deleted.append(user_id)
        row.deleted_for = json.dumps(deleted)
        return True


def delete_message(message_id, user_id, is_admin=False):
    """Suppression douce d'un message : réservée à son auteur (ou un admin)."""
    with get_session() as s:
        msg = s.get(MessageRow, message_id)
        if not msg:
            return None
        if msg.sender_id != user_id and not is_admin:
            return False
        msg.deleted = "true"
        s.flush()
        return _message_to_dict(msg)
