import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class UserRow(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    # Nullable : un compte créé via Facebook n'a pas de mot de passe MboaTrip.
    password_hash = Column(String, nullable=True)
    facebook_id = Column(String, unique=True, nullable=True, index=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    preferences = Column(JSONB, default=list)
    role = Column(String, default="user")
    bio = Column(String, default="")
    avatar_url = Column(String, default="")
    city = Column(String, default="")
    country = Column(String, default="")
    messaging_privacy = Column(String, nullable=False, default="everyone")  # "everyone" | "nobody"
    notifications_enabled = Column(Boolean, nullable=False, default=True)
    theme_preference = Column(String, nullable=False, default="light")  # "light" | "dark"
    reset_token_hash = Column(String, nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)


class AdminSettingRow(Base):
    """
    Petite table clé/valeur pour des réglages admin simples — sert
    notamment à enregistrer manuellement le nombre d'utilisateurs de
    l'ancienne version de MboaTrip (aucune donnée de l'ancien déploiement
    n'étant accessible automatiquement depuis cette base), affiché en plus
    du compteur d'utilisateurs actuels dans le tableau de bord admin.
    """
    __tablename__ = "admin_settings"

    key = Column(String, primary_key=True)
    value = Column(String, default="")
