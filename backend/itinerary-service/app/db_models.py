import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class DestinationRow(Base):
    """
    Contenu curaté (Bandjoun, Bafoussam, leurs sites/hôtels/photos...) stocké
    en un seul bloc JSONB — cette donnée est riche et imbriquée (points
    d'intérêt, tableaux d'images, etc.) et n'a jamais besoin d'être filtrée
    finement côté SQL : tout le filtrage/tri se fait déjà en Python dans
    search_destinations(), donc un JSONB "tel quel" évite une normalisation
    coûteuse pour zéro bénéfice réel ici.
    """
    __tablename__ = "destinations"
    id = Column(String, primary_key=True)
    data = Column(JSONB, nullable=False)


class ExpenseRow(Base):
    """
    Dépense partagée sur un itinéraire — répartie à parts égales entre le
    créateur de l'itinéraire et les personnes avec qui il est partagé
    (shared_with). paid_by_user_id = qui a avancé l'argent ; le calcul de
    qui doit combien à qui se fait à la volée (voir expenses.py), pas
    stocké, pour toujours refléter la liste actuelle des participants.
    """
    __tablename__ = "expenses"
    id = Column(String, primary_key=True, default=_uuid)
    itinerary_id = Column(String, nullable=False, index=True)
    added_by_user_id = Column(String, nullable=False)
    paid_by_user_id = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount_fcfa = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)


class ItineraryRow(Base):
    __tablename__ = "itineraries"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    destination_id = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    notes = Column(String, default="")
    shared_with = Column(JSONB, default=list)
    is_public = Column(Boolean, nullable=False, default=False)  # lien de partage public (lecture seule)
    created_at = Column(DateTime(timezone=True), default=_now)


class BookingRequestRow(Base):
    """
    Demande de réservation d'hôtel. MboaTrip n'a pas de passerelle de
    paiement ni de compte "hôtelier" : cette table sert de boîte de
    réception pour que l'admin puisse traiter la demande manuellement
    (appeler l'hôtel, confirmer avec le client). hotel_name est le nom tel
    qu'affiché dans l'app (pas d'id d'hôtel en base, les hôtels sont des
    données statiques du frontend).
    """
    __tablename__ = "booking_requests"
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    hotel_name = Column(String, nullable=False)
    city = Column(String, default="")
    check_in = Column(String, nullable=False)
    check_out = Column(String, nullable=False)
    guests = Column(String, default="1")
    contact_phone = Column(String, default="")
    notes = Column(String, default="")
    status = Column(String, default="pending")  # pending | confirmed | cancelled
    # Frais de réservation via MTN MoMo — non remboursables, distincts du
    # paiement du séjour lui-même (payé sur place, à l'hôtel).
    fee_amount_fcfa = Column(String, default="0")
    payment_status = Column(String, default="unpaid")  # unpaid | pending | paid | failed
    momo_reference_id = Column(String, nullable=True, unique=True)
    momo_phone = Column(String, default="")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, index=True)
