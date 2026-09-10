from flask import Blueprint, request, jsonify
from app import models
from app.errors import ApiError
from app.auth_middleware import requires_internal_key, requires_admin

destinations_bp = Blueprint("destinations", __name__)


@destinations_bp.get("/destinations")
def get_destinations():
    args = request.args
    result = models.search_destinations(
        search=args.get("search"), tag=args.get("tag"), region=args.get("region"),
        sort_by=args.get("sortBy", "popularity"), order=args.get("order", "desc"),
        page=args.get("page", 1), limit=args.get("limit", 10),
    )
    return jsonify({"success": True, **result}), 200


@destinations_bp.get("/destinations/<dest_id>")
def get_destination_by_id(dest_id):
    dest = models.find_destination_by_id(dest_id)
    if not dest:
        raise ApiError(404, "Destination introuvable")
    return jsonify({"success": True, "data": dest}), 200


@destinations_bp.post("/destinations/<dest_id>/admin/pois")
@requires_admin
def admin_add_poi(dest_id):
    """
    Ajoute un tout nouveau point d'intérêt (site touristique) à une
    destination. Corps attendu : { name, type?, description?, imageUrl?,
    images?, lat?, lng? }
    """
    body = request.get_json(force=True, silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        raise ApiError(422, "name requis")
    poi = {
        "name": name,
        "type": body.get("type", ""),
        "description": body.get("description", ""),
        "imageUrl": body.get("imageUrl", ""),
        "images": body.get("images", []),
        "lat": body.get("lat"),
        "lng": body.get("lng"),
    }
    result = models.admin_add_poi(dest_id, poi)
    if result is None:
        raise ApiError(404, "Destination introuvable")
    return jsonify({"success": True, "data": result}), 201


@destinations_bp.patch("/destinations/<dest_id>/admin/pois/<int:poi_index>/photos")
@requires_admin
def admin_update_poi_photos(dest_id, poi_index):
    """
    Modifie les photos d'un site touristique (POI) précis, pour la page
    admin — ajoute/remplace la photo principale et/ou la galerie.
    Corps attendu : { "imageUrl"?: string, "images"?: string[] }
    """
    body = request.get_json(force=True, silent=True) or {}
    if "imageUrl" not in body and "images" not in body:
        raise ApiError(422, "imageUrl et/ou images requis")
    images = body.get("images")
    if images is not None and not isinstance(images, list):
        raise ApiError(422, "images doit être un tableau d'URLs")
    result = models.admin_update_poi_images(dest_id, poi_index, body.get("imageUrl"), images)
    if result is None:
        raise ApiError(404, "Destination introuvable")
    if result == "not_found":
        raise ApiError(404, "Point d'intérêt introuvable à cet index")
    return jsonify({"success": True, "data": result}), 200


# ---------- Route interne : le Recommendation Service lit tout le catalogue ----------
@destinations_bp.get("/internal/destinations")
@requires_internal_key
def internal_get_all_destinations():
    return jsonify({"success": True, "data": models.find_all_destinations()}), 200
