"""Routes des itinéraires : création, consultation, partage."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app import models
from app.auth import requires_auth
from app.errors import ApiError
from app.validators import validate_itinerary, validate_share

itineraries_bp = Blueprint("itineraries", __name__, url_prefix="/api/itineraries")


@itineraries_bp.post("")
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
        user_id=g.user["id"],
        title=data["title"].strip(),
        destination_id=data["destinationId"],
        start_date=data["startDate"],
        end_date=data["endDate"],
        notes=data.get("notes", ""),
    )
    return jsonify({"success": True, "data": itinerary}), 201


@itineraries_bp.get("")
@requires_auth
def get_itineraries():
    itineraries = models.find_itineraries_by_user(g.user["id"])
    return jsonify({"success": True, "data": itineraries, "count": len(itineraries)}), 200


@itineraries_bp.get("/<itinerary_id>")
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


@itineraries_bp.post("/<itinerary_id>/share")
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

    target = models.find_user_by_email(data["email"])
    if not target:
        raise ApiError(404, "Aucun utilisateur trouvé avec cet email")

    updated = models.share_itinerary_with(itinerary_id, target["id"])
    return jsonify({"success": True, "data": updated}), 200
