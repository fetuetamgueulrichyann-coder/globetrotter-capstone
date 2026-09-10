"""
Publications & photos (Phase 2 — MboaTrip Social).

POST /posts               création (auth, multipart/form-data)
GET  /posts                fil (public, pagination + filtres userId/city)
GET  /posts/<id>            détail (public)
DELETE /posts/<id>          suppression (auth, auteur uniquement)
GET  /uploads/<filename>    sert les photos uploadées
"""
from flask import Blueprint, request, jsonify, g, send_from_directory

from app.config import Config
from app.errors import ApiError
from app.auth_middleware import requires_auth, optional_auth
from app import models, logger
from app import comments as comments_store
from app import favorites as favorites_store
from app.clients import get_user_identity
from app.events import publish_event
from app.validators import validate_post_fields, save_uploaded_images, delete_image_files, ImageRejected

posts_bp = Blueprint("posts", __name__)


@posts_bp.get("/posts/admin/stats")
@requires_auth
def admin_social_stats():
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    return jsonify({
        "success": True,
        "data": {
            "postsCount": models.count_posts(),
            "commentsCount": comments_store.count_all_comments(),
        },
    }), 200


def _serialize(post, requester_id=None):
    return {
        "id": post["id"],
        "userId": post["userId"],
        "author": get_user_identity(post["userId"]),
        "city": post["city"],
        "locationName": post["locationName"],
        "caption": post["caption"],
        "visitDate": post["visitDate"],
        "images": post["images"],
        "createdAt": post["createdAt"],
        "commentsCount": comments_store.count_comments_for_post(post["id"]),
        "isFavorited": favorites_store.is_favorited(requester_id, post["id"]) if requester_id else False,
    }


@posts_bp.post("/posts")
@requires_auth
def create_post():
    city = (request.form.get("city") or "").strip()
    location_name = (request.form.get("locationName") or "").strip()[:150]
    caption = request.form.get("caption") or ""
    visit_date = (request.form.get("visitDate") or "").strip() or None

    errors = validate_post_fields(city, caption, visit_date)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    files = [f for f in request.files.getlist("images") if f and f.filename]
    if not files:
        raise ApiError(422, "Au moins une photo est requise", [{"field": "images", "message": "Ajoute au moins une photo"}])

    try:
        image_urls = save_uploaded_images(files)
    except ImageRejected as e:
        raise ApiError(422, e.message, [{"field": "images", "message": e.message}])

    post = models.create_post(g.user["id"], city, location_name, caption.strip(), visit_date, image_urls)
    logger.info("Nouvelle publication", postId=post["id"], userId=g.user["id"])
    publish_event("post.created", {"postId": post["id"], "userId": g.user["id"], "city": city})

    return jsonify({"success": True, "data": _serialize(post, g.user["id"])}), 201


@posts_bp.get("/posts")
def get_feed():
    user_id = request.args.get("userId")
    city = request.args.get("city")
    try:
        limit = min(max(int(request.args.get("limit", 20)), 1), 50)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        raise ApiError(422, "Paramètres de pagination invalides")

    posts, total = models.list_posts(user_id=user_id, city=city, limit=limit, offset=offset)
    requester_id = optional_auth()
    return jsonify({
        "success": True,
        "data": [_serialize(p, requester_id) for p in posts],
        "pagination": {"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total},
    }), 200


@posts_bp.get("/posts/<post_id>")
def get_post(post_id):
    post = models.find_by_id(post_id)
    if not post:
        raise ApiError(404, "Publication introuvable")
    return jsonify({"success": True, "data": _serialize(post, optional_auth())}), 200


@posts_bp.delete("/posts/<post_id>")
@requires_auth
def delete_post(post_id):
    result = models.delete_post(post_id, g.user["id"])
    if result is None:
        raise ApiError(404, "Publication introuvable")
    if result == "forbidden":
        raise ApiError(403, "Tu ne peux supprimer que tes propres publications")

    delete_image_files(result["images"])
    for c in comments_store.list_comments_for_post(post_id):
        comments_store.delete_votes_for_comment(c["id"])
    comments_store.delete_comments_for_post(post_id)
    favorites_store.delete_favorites_for_post(post_id)
    logger.info("Publication supprimée", postId=post_id, userId=g.user["id"])
    return jsonify({"success": True, "message": "Publication supprimée"}), 200


@posts_bp.get("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(Config.UPLOADS_DIR, filename)
