"""Avis + notes 1-5 étoiles sur un lieu (site touristique, hôtel, restaurant, spa, plat...)."""
from flask import Blueprint, request, jsonify, g

from app import place_reviews
from app.auth_middleware import requires_auth
from app.errors import ApiError
from app.clients import get_user_identities

places_bp = Blueprint("places", __name__, url_prefix="/places")


@places_bp.get("/<place_id>/reviews")
def get_reviews(place_id):
    reviews = place_reviews.list_reviews_for_place(place_id)
    summary = place_reviews.get_place_summary(place_id)
    author_ids = {r["userId"] for r in reviews}
    identities = get_user_identities(list(author_ids))
    data = [{**r, "author": identities.get(r["userId"])} for r in reviews]
    return jsonify({"success": True, "data": data, "summary": summary}), 200


@places_bp.post("/<place_id>/reviews")
@requires_auth
def post_review(place_id):
    body = request.get_json(force=True, silent=True) or {}
    stars = body.get("stars")
    comment = (body.get("comment") or "").strip()
    place_name = (body.get("placeName") or "").strip()

    if not isinstance(stars, int) or not (1 <= stars <= 5):
        raise ApiError(422, "stars doit être un entier entre 1 et 5")
    if len(comment) > 2000:
        raise ApiError(422, "Avis trop long (max 2000 caractères)")

    review = place_reviews.upsert_review(place_id, place_name, g.user["id"], stars, comment)
    return jsonify({"success": True, "data": review}), 201


@places_bp.delete("/reviews/<review_id>")
@requires_auth
def remove_review(review_id):
    is_admin = g.user.get("role") == "admin"
    result = place_reviews.delete_review(review_id, g.user["id"], is_admin=is_admin)
    if result is None:
        raise ApiError(404, "Avis introuvable")
    if result == "forbidden":
        raise ApiError(403, "Tu ne peux supprimer que tes propres avis")
    return jsonify({"success": True, "message": "Avis supprimé"}), 200
