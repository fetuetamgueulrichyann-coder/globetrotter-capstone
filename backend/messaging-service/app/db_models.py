import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.db import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class ConversationRow(Base):
    """
    Trois formes de conversation, toutes stockées dans "type" :
    - "direct" (par défaut) : entre exactement deux utilisateurs. user_a_id
      est toujours l'id le plus petit lexicographiquement (voir models.py)
      pour garantir qu'une paire d'utilisateurs n'a jamais qu'une seule
      conversation, quel que soit l'ordre dans lequel on la crée.
    - "group" avec id == GENERAL_GROUP_ID : le groupe général, ouvert
      implicitement à tout le monde — aucune ligne dans
      conversation_participants n'est nécessaire pour lui.
    - "group" avec owner_id renseigné : groupe personnalisé créé par un
      utilisateur, dont les membres sont explicitement listés dans
      conversation_participants (table à part, pour permettre à chacun de
      quitter individuellement sans affecter les autres).
    """
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False, default="direct")
    title = Column(String, nullable=True)
    owner_id = Column(String, nullable=True)  # créateur d'un groupe personnalisé (null pour "direct" et le groupe général)
    user_a_id = Column(String, nullable=True, index=True)
    user_b_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    last_message_at = Column(DateTime(timezone=True), default=_now)
    deleted_for = Column(Text, nullable=True)  # liste JSON d'ids utilisateur ayant supprimé la conv. (masquage local, jamais pour "group")

    messages = relationship("MessageRow", back_populates="conversation", order_by="MessageRow.created_at")

    __table_args__ = (
        Index("ix_conversations_pair", "user_a_id", "user_b_id", unique=True),
    )


class ConversationParticipantRow(Base):
    """Appartenance à un groupe personnalisé — n'existe pas pour les conversations "direct" ni pour le groupe général."""
    __tablename__ = "conversation_participants"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (
        Index("ix_conversation_participants_unique", "conversation_id", "user_id", unique=True),
    )


class MessageRow(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    type = Column(String, nullable=False, default="text")  # "text" | "voice" | "call"
    audio_url = Column(String, nullable=True)
    duration_seconds = Column(String, nullable=True)  # réutilisé pour la durée d'un message vocal ET d'un appel
    call_kind = Column(String, nullable=True)  # "audio" | "video" (uniquement si type == "call")
    call_status = Column(String, nullable=True)  # "completed" | "missed" | "declined" (uniquement si type == "call")
    created_at = Column(DateTime(timezone=True), default=_now, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    deleted = Column(String, nullable=False, default="false")  # "true"/"false" — suppression douce, message remplacé côté API

    conversation = relationship("ConversationRow", back_populates="messages")
