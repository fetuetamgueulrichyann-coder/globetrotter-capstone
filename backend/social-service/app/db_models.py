import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class PostRow(Base):
    __tablename__ = "posts"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False)
    location_name = Column(String, default="")
    caption = Column(String, nullable=False)
    visit_date = Column(String, nullable=True)
    images = Column(JSONB, default=list)  # tableau d'URLs — équivalent documentaire de la table PostImage
    created_at = Column(DateTime(timezone=True), default=_now, index=True)


class CommentRow(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=_uuid)
    post_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)


class CommentVoteRow(Base):
    __tablename__ = "comment_votes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_comment_vote_user"),)
    id = Column(String, primary_key=True, default=_uuid)
    comment_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    value = Column(String, nullable=False)  # 'helpful' | 'unhelpful'


class CommentReportRow(Base):
    """
    Signalement d'un commentaire par un utilisateur — modération
    communautaire, en complément (pas en remplacement) de la modération
    admin. Un seul signalement par utilisateur et par commentaire.
    """
    __tablename__ = "comment_reports"
    __table_args__ = (UniqueConstraint("comment_id", "reporter_id", name="uq_report_user_comment"),)
    id = Column(String, primary_key=True, default=_uuid)
    comment_id = Column(String, nullable=False, index=True)
    reporter_id = Column(String, nullable=False)
    reason = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=_now)
    created_at = Column(DateTime(timezone=True), default=_now)


class FavoriteRow(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_favorite_user_post"),)
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    post_id = Column(String, nullable=False)
    city = Column(String, default="")
    location_name = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=_now)


class PlaceReviewRow(Base):
    """
    Avis + note 1-5 étoiles sur un lieu (site touristique, hôtel, restaurant,
    plat, spa...). place_id est un identifiant stable calculé côté frontend
    (slug du nom du lieu) — pas de dépendance à un autre microservice.
    Un seul avis par utilisateur et par lieu (on modifie plutôt qu'on
    duplique si l'utilisateur change d'avis).
    """
    __tablename__ = "place_reviews"
    __table_args__ = (UniqueConstraint("place_id", "user_id", name="uq_review_user_place"),)
    id = Column(String, primary_key=True, default=_uuid)
    place_id = Column(String, nullable=False, index=True)
    place_name = Column(String, default="")
    user_id = Column(String, nullable=False)
    stars = Column(Integer, nullable=False)
    comment = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=_now, index=True)


class LocalAlertRow(Base):
    """
    Alerte communautaire hyper-locale (route coupée, prix qui grimpe, lieu
    fermé...) — signalée par les utilisateurs eux-mêmes, contrairement à
    Google Maps où ce type d'info locale est souvent périmé. Expire
    automatiquement après quelques jours (voir alerts.py) plutôt que d'être
    supprimée en dur, pour garder un historique léger côté modération.
    """
    __tablename__ = "local_alerts"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False, index=True)
    place_name = Column(String, default="")
    alert_type = Column(String, nullable=False)  # route | price | closed | other
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, index=True)


class LocalGuideRow(Base):
    """
    Guide local vérifié (mise en relation directe, pas de réservation en
    ligne pour l'instant) — ajouté uniquement par l'admin après vérification
    manuelle, pour garantir que ce sont de vraies personnes fiables et pas
    n'importe qui qui s'auto-déclare guide.
    """
    __tablename__ = "local_guides"
    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    city = Column(String, nullable=False, index=True)
    specialty = Column(String, default="")
    bio = Column(String, default="")
    photo_url = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=_now)


class PlaceSuggestionRow(Base):
    """
    Suggestion d'ajout de lieu envoyée par un utilisateur (photo + description)
    — en attente de revue par l'admin, qui décide de l'ajouter ou non aux
    destinations officielles. Rien n'est publié automatiquement.
    """
    __tablename__ = "place_suggestions"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    city = Column(String, default="")
    description = Column(String, nullable=False)
    photo_url = Column(String, default="")
    status = Column(String, nullable=False, default="pending", index=True)  # pending | approved | rejected
    admin_note = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=_now, index=True)
