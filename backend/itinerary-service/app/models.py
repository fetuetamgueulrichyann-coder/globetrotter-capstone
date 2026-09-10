"""
Couche de données de l'Itinerary Service — PostgreSQL (SQLAlchemy).

Mêmes signatures de fonctions qu'avant (basées sur destinations.json /
itineraries.json) : destinations.py et itineraries.py n'ont besoin d'aucune
modification, seul le stockage en dessous a changé.
"""
from app.db import get_session
from app.db_models import DestinationRow, ItineraryRow


# ============ DESTINATIONS (lecture) ============

def find_all_destinations():
    with get_session() as s:
        rows = s.query(DestinationRow).all()
        return [r.data for r in rows]


def find_destination_by_id(dest_id):
    with get_session() as s:
        row = s.get(DestinationRow, dest_id)
        return row.data if row else None


# ============ DESTINATIONS (écriture — admin uniquement) ============

def admin_update_poi_images(dest_id, poi_index, image_url, images):
    """
    Remplace les photos d'un point d'intérêt (imageUrl + galerie images[]).
    Réassigne tout le dict `data` (plutôt que de muter le sous-objet en
    place) car SQLAlchemy ne détecte pas toujours une mutation profonde d'une
    colonne JSONB comme un changement à sauvegarder.
    """
    with get_session() as s:
        row = s.get(DestinationRow, dest_id)
        if not row:
            return None
        data = dict(row.data)
        pois = list(data.get("pointsOfInterest", []))
        if not (0 <= poi_index < len(pois)):
            return "not_found"
        poi = dict(pois[poi_index])
        if image_url is not None:
            poi["imageUrl"] = image_url
        if images is not None:
            poi["images"] = images
        pois[poi_index] = poi
        data["pointsOfInterest"] = pois
        row.data = data
        return data


def admin_add_poi(dest_id, poi):
    """Ajoute un tout nouveau point d'intérêt à une destination (admin)."""
    with get_session() as s:
        row = s.get(DestinationRow, dest_id)
        if not row:
            return None
        data = dict(row.data)
        pois = list(data.get("pointsOfInterest", []))
        pois.append(poi)
        data["pointsOfInterest"] = pois
        row.data = data
        return data


def search_destinations(search=None, tag=None, region=None, sort_by="popularity", order="desc", page=1, limit=10):
    results = list(find_all_destinations())

    if search:
        q = search.lower()
        results = [d for d in results if q in d["name"].lower() or q in d.get("region", "").lower()]
    if tag:
        results = [d for d in results if tag.lower() in [t.lower() for t in d.get("tags", [])]]
    if region:
        results = [d for d in results if d.get("region", "").lower() == region.lower()]

    allowed_sort = {"popularity", "name", "pricePerDay"}
    sort_field = sort_by if sort_by in allowed_sort else "popularity"
    results.sort(key=lambda d: d[sort_field], reverse=(order != "asc"))

    total = len(results)
    page_num = max(1, int(page or 1))
    limit_num = max(1, min(100, int(limit or 10)))
    start = (page_num - 1) * limit_num
    return {
        "data": results[start:start + limit_num],
        "pagination": {"total": total, "page": page_num, "limit": limit_num,
                        "totalPages": max(1, -(-total // limit_num))},
    }


# ============ ITINERARIES ============

def _to_dict(row):
    if not row:
        return None
    return {
        "id": row.id, "userId": row.user_id, "title": row.title,
        "destinationId": row.destination_id, "startDate": row.start_date, "endDate": row.end_date,
        "notes": row.notes or "", "sharedWith": row.shared_with or [],
        "isPublic": bool(row.is_public),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def find_itineraries_by_user(user_id):
    with get_session() as s:
        rows = s.query(ItineraryRow).all()
        return [_to_dict(r) for r in rows if r.user_id == user_id or user_id in (r.shared_with or [])]


def find_itinerary_by_id(itinerary_id):
    with get_session() as s:
        row = s.get(ItineraryRow, itinerary_id)
        return _to_dict(row)


def delete_itinerary(itinerary_id):
    """Suppression demandée par son propriétaire (ou un admin) — supprime aussi les dépenses partagées associées."""
    from app.db_models import ExpenseRow
    with get_session() as s:
        s.query(ExpenseRow).filter_by(itinerary_id=itinerary_id).delete()
        row = s.get(ItineraryRow, itinerary_id)
        if row:
            s.delete(row)
        return True


def create_itinerary(user_id, title, destination_id, start_date, end_date, notes=""):
    with get_session() as s:
        row = ItineraryRow(
            user_id=user_id, title=title, destination_id=destination_id,
            start_date=start_date, end_date=end_date, notes=notes or "", shared_with=[],
        )
        s.add(row)
        s.flush()
        return _to_dict(row)


def share_itinerary_with(itinerary_id, target_user_id):
    with get_session() as s:
        row = s.get(ItineraryRow, itinerary_id)
        if not row:
            return None
        shared = list(row.shared_with or [])
        if target_user_id not in shared:
            shared.append(target_user_id)
            row.shared_with = shared
        return _to_dict(row)


def set_itinerary_public(itinerary_id, is_public):
    """Active ou désactive le lien de partage public (lecture seule) d'un itinéraire."""
    with get_session() as s:
        row = s.get(ItineraryRow, itinerary_id)
        if not row:
            return None
        row.is_public = is_public
        return _to_dict(row)


def find_public_itinerary(itinerary_id):
    """Utilisé par la page de partage : aucune authentification requise, uniquement si is_public=True."""
    with get_session() as s:
        row = s.get(ItineraryRow, itinerary_id)
        if not row or not row.is_public:
            return None
        return _to_dict(row)


# ============ DEMANDES DE RÉSERVATION D'HÔTEL ============

def _booking_to_dict(row):
    return {
        "id": row.id, "userId": row.user_id, "hotelName": row.hotel_name, "city": row.city,
        "checkIn": row.check_in, "checkOut": row.check_out, "guests": row.guests,
        "contactPhone": row.contact_phone, "notes": row.notes, "status": row.status,
        "feeAmountFcfa": int(row.fee_amount_fcfa or 0), "paymentStatus": row.payment_status,
        "momoPhone": row.momo_phone, "paidAt": row.paid_at.isoformat() if row.paid_at else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def create_booking_request(user_id, hotel_name, city, check_in, check_out, guests, contact_phone, notes):
    from app.db_models import BookingRequestRow
    from app.config import Config
    with get_session() as s:
        row = BookingRequestRow(
            user_id=user_id, hotel_name=hotel_name, city=city, check_in=check_in, check_out=check_out,
            guests=str(guests), contact_phone=contact_phone, notes=notes,
            fee_amount_fcfa=str(Config.BOOKING_FEE_FCFA),
        )
        s.add(row)
        s.flush()
        return _booking_to_dict(row)


def find_bookings_by_user(user_id):
    from app.db_models import BookingRequestRow
    with get_session() as s:
        rows = s.query(BookingRequestRow).filter_by(user_id=user_id).order_by(BookingRequestRow.created_at.desc()).all()
        return [_booking_to_dict(r) for r in rows]


def find_all_bookings():
    from app.db_models import BookingRequestRow
    with get_session() as s:
        rows = s.query(BookingRequestRow).order_by(BookingRequestRow.created_at.desc()).all()
        return [_booking_to_dict(r) for r in rows]


def update_booking_status(booking_id, status):
    from app.db_models import BookingRequestRow
    with get_session() as s:
        row = s.get(BookingRequestRow, booking_id)
        if not row:
            return None
        row.status = status
        return _booking_to_dict(row)


def find_booking_by_id(booking_id):
    from app.db_models import BookingRequestRow
    with get_session() as s:
        row = s.get(BookingRequestRow, booking_id)
        return _booking_to_dict(row) if row else None


def start_booking_payment(booking_id, momo_reference_id, momo_phone):
    from app.db_models import BookingRequestRow
    with get_session() as s:
        row = s.get(BookingRequestRow, booking_id)
        if not row:
            return None
        row.momo_reference_id = momo_reference_id
        row.momo_phone = momo_phone
        row.payment_status = "pending"
        return _booking_to_dict(row)


def set_booking_payment_status(booking_id, payment_status):
    from app.db_models import BookingRequestRow
    with get_session() as s:
        row = s.get(BookingRequestRow, booking_id)
        if not row:
            return None
        row.payment_status = payment_status
        if payment_status == "paid" and not row.paid_at:
            from datetime import datetime, timezone
            row.paid_at = datetime.now(timezone.utc)
        return _booking_to_dict(row)


# ============ DÉPENSES PARTAGÉES (répartition entre amis) ============

def _expense_to_dict(row):
    return {
        "id": row.id, "itineraryId": row.itinerary_id, "addedByUserId": row.added_by_user_id,
        "paidByUserId": row.paid_by_user_id, "description": row.description,
        "amountFcfa": int(row.amount_fcfa), "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def itinerary_participants(itinerary_id):
    """Le créateur de l'itinéraire + toutes les personnes avec qui il est partagé."""
    it = find_itinerary_by_id(itinerary_id)
    if not it:
        return []
    return [it["userId"]] + [uid for uid in (it.get("sharedWith") or []) if uid != it["userId"]]


def create_expense(itinerary_id, added_by_user_id, paid_by_user_id, description, amount_fcfa):
    from app.db_models import ExpenseRow
    with get_session() as s:
        row = ExpenseRow(
            itinerary_id=itinerary_id, added_by_user_id=added_by_user_id, paid_by_user_id=paid_by_user_id,
            description=description, amount_fcfa=str(amount_fcfa),
        )
        s.add(row)
        s.flush()
        return _expense_to_dict(row)


def list_expenses_for_itinerary(itinerary_id):
    from app.db_models import ExpenseRow
    with get_session() as s:
        rows = s.query(ExpenseRow).filter_by(itinerary_id=itinerary_id).order_by(ExpenseRow.created_at.desc()).all()
        return [_expense_to_dict(r) for r in rows]


def delete_expense(expense_id, user_id):
    from app.db_models import ExpenseRow
    with get_session() as s:
        row = s.get(ExpenseRow, expense_id)
        if not row:
            return None
        if row.added_by_user_id != user_id and row.paid_by_user_id != user_id:
            return "forbidden"
        s.delete(row)
        return True


def compute_balances(itinerary_id):
    """
    Calcule qui doit combien à qui, à parts égales entre tous les
    participants de l'itinéraire. Retourne {userId: solde_net_fcfa} —
    positif = on lui doit de l'argent, négatif = il doit de l'argent.
    Recalculé à la volée à chaque appel (jamais stocké), pour toujours
    refléter la liste actuelle des participants même si elle change.
    """
    participants = itinerary_participants(itinerary_id)
    if not participants:
        return {}
    balances = {uid: 0.0 for uid in participants}
    expenses = list_expenses_for_itinerary(itinerary_id)
    n = len(participants)
    for exp in expenses:
        share = exp["amountFcfa"] / n
        if exp["paidByUserId"] in balances:
            balances[exp["paidByUserId"]] += exp["amountFcfa"]
        for uid in participants:
            balances[uid] -= share
    return {uid: round(v) for uid, v in balances.items()}
