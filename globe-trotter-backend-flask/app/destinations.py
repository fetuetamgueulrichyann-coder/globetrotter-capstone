"""Routes des destinations : recherche, filtre, tri, pagination."""
from flask import Blueprint, request, jsonify
from app import models
from app.errors import ApiError

destinations_bp = Blueprint("destinations", __name__, url_prefix="/api/destinations")


@destinations_bp.get("")
def get_destinations():
    args = request.args
    result = models.search_destinations(
        search=args.get("search"),
        tag=args.get("tag"),
        sort_by=args.get("sortBy", "popularity"),
        order=args.get("order", "desc"),
        page=args.get("page", 1),
        limit=args.get("limit", 10),
    )
    return jsonify({"success": True, **result}), 200


@destinations_bp.get("/<dest_id>")
def get_destination_by_id(dest_id):
    dest = models.find_destination_by_id(dest_id)
    if not dest:
        raise ApiError(404, "Destination introuvable")
    return jsonify({"success": True, "data": dest}), 200
