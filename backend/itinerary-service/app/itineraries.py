from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app import models
from app.auth_middleware import requires_auth, requires_internal_key
from app.errors import ApiError
from app.validators import validate_itinerary, validate_share
from app.events import publish_event

itineraries_bp = Blueprint("itineraries", __name__)


@itineraries_bp.post("/itineraries/bookings")
@requires_auth
def create_booking():
    """Demande de réservation d'hôtel — n'engage aucun paiement, c'est une boîte de réception pour l'admin."""
    data = request.get_json(force=True, silent=True) or {}
    hotel_name = (data.get("hotelName") or "").strip()
    check_in = (data.get("checkIn") or "").strip()
    check_out = (data.get("checkOut") or "").strip()
    if not hotel_name or not check_in or not check_out:
        raise ApiError(422, "hotelName, checkIn et checkOut sont requis")
    if check_out <= check_in:
        raise ApiError(422, "La date de départ doit être après la date d'arrivée")

    booking = models.create_booking_request(
        user_id=g.user["id"], hotel_name=hotel_name, city=data.get("city", ""),
        check_in=check_in, check_out=check_out, guests=data.get("guests", 1),
        contact_phone=data.get("contactPhone", ""), notes=data.get("notes", ""),
    )
    return jsonify({"success": True, "data": booking}), 201


@itineraries_bp.get("/itineraries/bookings")
@requires_auth
def get_my_bookings():
    return jsonify({"success": True, "data": models.find_bookings_by_user(g.user["id"])}), 200


@itineraries_bp.get("/itineraries/bookings/admin/all")
@requires_auth
def admin_get_all_bookings():
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    return jsonify({"success": True, "data": models.find_all_bookings()}), 200


@itineraries_bp.patch("/itineraries/bookings/<booking_id>/admin/status")
@requires_auth
def admin_update_booking_status(booking_id):
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    data = request.get_json(force=True, silent=True) or {}
    status = data.get("status")
    if status not in ("pending", "confirmed", "cancelled"):
        raise ApiError(422, "status doit être pending, confirmed ou cancelled")
    updated = models.update_booking_status(booking_id, status)
    if not updated:
        raise ApiError(404, "Demande introuvable")
    return jsonify({"success": True, "data": updated}), 200


@itineraries_bp.post("/itineraries/bookings/<booking_id>/pay")
@requires_auth
def pay_booking_fee(booking_id):
    """
    Démarre le paiement des frais de réservation via MTN Mobile Money.
    Le client reçoit une notification sur son téléphone pour valider — le
    frontend interroge ensuite /payment-status pour connaître le résultat.
    """
    from app import momo_client

    booking = models.find_booking_by_id(booking_id)
    if not booking or booking["userId"] != g.user["id"]:
        raise ApiError(404, "Demande de réservation introuvable")
    if booking["paymentStatus"] == "paid":
        raise ApiError(409, "Ces frais ont déjà été payés")

    data = request.get_json(force=True, silent=True) or {}
    phone = (data.get("phone") or "").strip()
    if not phone:
        raise ApiError(422, "Numéro de téléphone Mobile Money requis")

    try:
        reference_id = momo_client.request_to_pay(
            amount=booking["feeAmountFcfa"], phone_msisdn=phone, external_id=booking_id,
        )
    except momo_client.MomoNotConfigured:
        raise ApiError(503, "Le paiement Mobile Money n'est pas encore activé sur MboaTrip")
    except Exception:
        logger.error("Échec de la demande de paiement MTN MoMo", bookingId=booking_id)
        raise ApiError(502, "Le service Mobile Money est temporairement indisponible, réessaie dans un instant")

    updated = models.start_booking_payment(booking_id, reference_id, phone)
    return jsonify({"success": True, "data": updated}), 202


@itineraries_bp.get("/itineraries/bookings/<booking_id>/payment-status")
@requires_auth
def get_booking_payment_status(booking_id):
    from app import momo_client

    booking = models.find_booking_by_id(booking_id)
    if not booking or booking["userId"] != g.user["id"]:
        raise ApiError(404, "Demande de réservation introuvable")

    # booking (dict public) n'expose pas momo_reference_id : on relit la
    # colonne directement pour interroger MTN.
    from app.db_models import BookingRequestRow
    from app.db import get_session
    with get_session() as s:
        row = s.get(BookingRequestRow, booking_id)
        ref = row.momo_reference_id if row else None

    if booking["paymentStatus"] == "pending" and ref:
        try:
            momo_status = momo_client.check_payment_status(ref)
        except Exception:
            momo_status = "PENDING"
        if momo_status == "SUCCESSFUL":
            booking = models.set_booking_payment_status(booking_id, "paid")
        elif momo_status == "FAILED":
            booking = models.set_booking_payment_status(booking_id, "failed")

    return jsonify({"success": True, "data": booking}), 200


@itineraries_bp.post("/itineraries")
@requires_auth
def create_itinerary():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_itinerary(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    dest = models.find_destination_by_id(data["destinationId"])
    if not dest:
        raise ApiError(422, "La destination spécifiée n'existe pas",
                        [{"field": "destinationId", "message": "Destination inconnue"}])

    start = datetime.fromisoformat(data["startDate"][:10])
    end = datetime.fromisoformat(data["endDate"][:10])
    if end < start:
        raise ApiError(422, "La date de fin doit être postérieure à la date de début",
                        [{"field": "endDate", "message": "Date de fin invalide"}])

    itinerary = models.create_itinerary(
        g.user["id"], data["title"].strip(), data["destinationId"],
        data["startDate"], data["endDate"], data.get("notes", ""),
    )

    # Événement async : le Recommendation Service invalidera son cache pour cet utilisateur
    publish_event("itinerary.created", {
        "userId": g.user["id"], "itineraryId": itinerary["id"], "destinationId": data["destinationId"],
    })

    return jsonify({"success": True, "data": itinerary}), 201


@itineraries_bp.get("/itineraries")
@requires_auth
def get_itineraries():
    itineraries = models.find_itineraries_by_user(g.user["id"])
    return jsonify({"success": True, "data": itineraries, "count": len(itineraries)}), 200


@itineraries_bp.get("/itineraries/<itinerary_id>")
@requires_auth
def get_itinerary_by_id(itinerary_id):
    itinerary = models.find_itinerary_by_id(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Itinéraire introuvable")
    is_owner = itinerary["userId"] == g.user["id"]
    is_shared = g.user["id"] in itinerary.get("sharedWith", [])
    if not is_owner and not is_shared:
        raise ApiError(403, "Vous n'avez pas accès à cet itinéraire")
    return jsonify({"success": True, "data": itinerary}), 200


@itineraries_bp.delete("/itineraries/<itinerary_id>")
@requires_auth
def delete_itinerary(itinerary_id):
    """Suppression réservée au créateur de l'itinéraire, ou à un administrateur."""
    itinerary = models.find_itinerary_by_id(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Itinéraire introuvable")
    is_owner = itinerary["userId"] == g.user["id"]
    is_admin = g.user.get("role") == "admin"
    if not is_owner and not is_admin:
        raise ApiError(403, "Seul le créateur de cet itinéraire peut le supprimer")
    models.delete_itinerary(itinerary_id)
    return jsonify({"success": True, "message": "Itinéraire supprimé"}), 200


@itineraries_bp.post("/itineraries/<itinerary_id>/share")
@requires_auth
def share_itinerary(itinerary_id):
    itinerary = models.find_itinerary_by_id(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Itinéraire introuvable")
    if itinerary["userId"] != g.user["id"]:
        raise ApiError(403, "Seul le propriétaire peut partager cet itinéraire")

    data = request.get_json(force=True, silent=True) or {}
    errors = validate_share(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    # Résolution de l'email -> userId via un appel synchrone au User Service
    import requests
    from app.config import Config
    try:
        r = requests.get(
            f"{Config.USER_SERVICE_URL}/internal/users/by-email",
            params={"email": data["email"]},
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY}, timeout=5,
        )
    except requests.RequestException:
        raise ApiError(503, "User Service indisponible, réessayez plus tard")

    if r.status_code == 404:
        raise ApiError(404, "Aucun utilisateur trouvé avec cet email")
    if r.status_code != 200:
        raise ApiError(502, "Erreur lors de la résolution de l'utilisateur cible")

    target_id = r.json()["data"]["id"]
    updated = models.share_itinerary_with(itinerary_id, target_id)
    return jsonify({"success": True, "data": updated}), 200


@itineraries_bp.post("/itineraries/<itinerary_id>/share-link")
@requires_auth
def enable_share_link(itinerary_id):
    """
    Active le lien de partage public en lecture seule : n'importe qui avec le
    lien peut consulter l'itinéraire (dates, destination, notes), sans avoir
    de compte MboaTrip ni être connecté. Réservé au propriétaire.
    """
    itinerary = models.find_itinerary_by_id(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Itinéraire introuvable")
    if itinerary["userId"] != g.user["id"]:
        raise ApiError(403, "Seul le propriétaire peut activer le partage")
    updated = models.set_itinerary_public(itinerary_id, True)
    return jsonify({"success": True, "data": updated}), 200


@itineraries_bp.delete("/itineraries/<itinerary_id>/share-link")
@requires_auth
def disable_share_link(itinerary_id):
    itinerary = models.find_itinerary_by_id(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Itinéraire introuvable")
    if itinerary["userId"] != g.user["id"]:
        raise ApiError(403, "Seul le propriétaire peut désactiver le partage")
    updated = models.set_itinerary_public(itinerary_id, False)
    return jsonify({"success": True, "data": updated}), 200


@itineraries_bp.get("/itineraries/<itinerary_id>/public")
def get_public_itinerary(itinerary_id):
    """
    Route volontairement sans @requires_auth : c'est la page ouverte par la
    personne qui a reçu le lien copié/partagé, elle n'a pas forcément de
    compte MboaTrip.
    """
    itinerary = models.find_public_itinerary(itinerary_id)
    if not itinerary:
        raise ApiError(404, "Ce lien de partage n'est plus valide")
    dest = models.find_destination_by_id(itinerary["destinationId"])
    return jsonify({"success": True, "data": {
        "title": itinerary["title"],
        "destination": dest,
        "startDate": itinerary["startDate"],
        "endDate": itinerary["endDate"],
        "notes": itinerary["notes"],
    }}), 200


def _require_participant(itinerary_id, user_id):
    """Seuls le créateur et les personnes avec qui l'itinéraire est partagé peuvent voir/ajouter des dépenses."""
    if user_id not in models.itinerary_participants(itinerary_id):
        raise ApiError(403, "Tu ne fais pas partie de cet itinéraire")


@itineraries_bp.get("/itineraries/<itinerary_id>/expenses")
@requires_auth
def get_expenses(itinerary_id):
    _require_participant(itinerary_id, g.user["id"])
    from app import clients
    expenses = models.list_expenses_for_itinerary(itinerary_id)
    balances = models.compute_balances(itinerary_id)
    identities = clients.get_user_identities(list(balances.keys()))
    balances_with_names = [
        {"userId": uid, "amountFcfa": amt, "user": identities.get(uid)} for uid, amt in balances.items()
    ]
    payer_identities = clients.get_user_identities([e["paidByUserId"] for e in expenses])
    expenses_with_names = [{**e, "paidBy": payer_identities.get(e["paidByUserId"])} for e in expenses]
    return jsonify({"success": True, "data": {"expenses": expenses_with_names, "balances": balances_with_names}}), 200


@itineraries_bp.post("/itineraries/<itinerary_id>/expenses")
@requires_auth
def add_expense(itinerary_id):
    _require_participant(itinerary_id, g.user["id"])
    data = request.get_json(force=True, silent=True) or {}
    description = (data.get("description") or "").strip()
    amount = data.get("amountFcfa")
    paid_by = data.get("paidByUserId") or g.user["id"]

    if not description or len(description) > 200:
        raise ApiError(422, "description requise (max 200 caractères)")
    if not isinstance(amount, int) or amount <= 0:
        raise ApiError(422, "amountFcfa doit être un entier positif")
    if paid_by not in models.itinerary_participants(itinerary_id):
        raise ApiError(422, "paidByUserId doit être un participant de l'itinéraire")

    expense = models.create_expense(itinerary_id, g.user["id"], paid_by, description, amount)
    return jsonify({"success": True, "data": expense}), 201


@itineraries_bp.delete("/itineraries/expenses/<expense_id>")
@requires_auth
def remove_expense(expense_id):
    result = models.delete_expense(expense_id, g.user["id"])
    if result is None:
        raise ApiError(404, "Dépense introuvable")
    if result == "forbidden":
        raise ApiError(403, "Tu ne peux supprimer que les dépenses que tu as ajoutées ou payées")
    return jsonify({"success": True, "message": "Dépense supprimée"}), 200


# ---------- Route interne : le Recommendation Service lit les itinéraires d'un user ----------
@itineraries_bp.get("/internal/itineraries")
@requires_internal_key
def internal_get_itineraries():
    user_id = request.args.get("userId")
    if not user_id:
        raise ApiError(422, "userId requis")
    return jsonify({"success": True, "data": models.find_itineraries_by_user(user_id)}), 200
