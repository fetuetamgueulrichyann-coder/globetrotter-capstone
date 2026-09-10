"""
Interactions sociales simplifiées (Phase 2 révisée) :
- commentaires sur une publication
- vote "utile / pas utile" (👍🏽/👎🏽) sur un commentaire
- favoris (étoile sur une publication)

Pas de followers/following, pas de page de profil — juste de quoi
identifier qui a écrit/voté (nom + avatar, via clients.get_user_identity).
"""
from flask import Blueprint, request, jsonify, g

from app.errors import ApiError
from app.auth_middleware import requires_auth, optional_auth
from app import models, comments as comments_store, favorites as favorites_store, logger
from app.clients import get_user_identity, get_user_identities
from app.validators import validate_comment_content
from app.events import publish_event

interactions_bp = Blueprint("interactions", __name__)

VALID_VOTE_VALUES = ("helpful", "unhelpful")


# --------------------------------------------------------------- Comments

@interactions_bp.post("/posts/<post_id>/comments")
@requires_auth
def add_comment(post_id):
    if not models.find_by_id(post_id):
        raise ApiError(404, "Publication introuvable")

    data = request.get_json(force=True, silent=True) or {}
    content = (data.get("content") or "").strip()
    errors = validate_comment_content(content)
    if errors:
        raise ApiError(422, "Commentaire invalide", errors)

    comment = comments_store.create_comment(post_id, g.user["id"], content)
    logger.info("Nouveau commentaire", postId=post_id, userId=g.user["id"])
    publish_event("comment.created", {"postId": post_id, "userId": g.user["id"]})

    return jsonify({"success": True, "data": _serialize_comment(comment, g.user["id"])}), 201


@interactions_bp.get("/posts/<post_id>/comments")
def get_comments(post_id):
    if not models.find_by_id(post_id):
        raise ApiError(404, "Publication introuvable")

    requester_id = optional_auth()
    items = comments_store.list_comments_for_post(post_id)
    return jsonify({"success": True, "data": [_serialize_comment(c, requester_id) for c in items]}), 200


@interactions_bp.delete("/comments/<comment_id>")
@requires_auth
def remove_comment(comment_id):
    is_admin = g.user.get("role") == "admin"
    result = comments_store.delete_comment(comment_id, g.user["id"], is_admin=is_admin)
    if result is None:
        raise ApiError(404, "Commentaire introuvable")
    if result == "forbidden":
        raise ApiError(403, "Tu ne peux supprimer que tes propres commentaires")

    comments_store.delete_votes_for_comment(comment_id)
    if is_admin:
        logger.info("Commentaire supprimé par un administrateur", commentId=comment_id, adminId=g.user["id"])
    return jsonify({"success": True, "message": "Commentaire supprimé"}), 200


@interactions_bp.post("/comments/<comment_id>/report")
@requires_auth
def report_comment(comment_id):
    """
    Modération communautaire : n'importe quel utilisateur peut signaler un
    commentaire abusif. Ne le supprime pas — fait juste remonter sa priorité
    dans la file de modération admin (voir list_all_comments, trié par
    nombre de signalements).
    """
    if not comments_store.find_comment(comment_id):
        raise ApiError(404, "Commentaire introuvable")
    body = request.get_json(force=True, silent=True) or {}
    result = comments_store.report_comment(comment_id, g.user["id"], reason=(body.get("reason") or "").strip())
    return jsonify({"success": True, "data": result}), 201


@interactions_bp.get("/comments/admin/all")
@requires_auth
def admin_list_comments():
    """Modération : liste de tous les commentaires récents, tous posts confondus."""
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    items = comments_store.list_all_comments()
    post_ids = {c["postId"] for c in items}
    posts_by_id = {pid: models.find_by_id(pid) for pid in post_ids}
    author_ids = {c["userId"] for c in items}
    identities = get_user_identities(list(author_ids))
    data = []
    for c in items:
        post = posts_by_id.get(c["postId"])
        data.append({
            **c,
            "author": identities.get(c["userId"]),
            "postCaption": post["caption"] if post else None,
        })
    return jsonify({"success": True, "data": data}), 200


def _serialize_comment(comment, requester_id=None):
    author = get_user_identity(comment["userId"])
    helpful_ids, unhelpful_ids = comments_store.list_votes_for_comment(comment["id"])
    return {
        "id": comment["id"],
        "postId": comment["postId"],
        "content": comment["content"],
        "createdAt": comment["createdAt"],
        "author": author,
        "helpfulCount": len(helpful_ids),
        "unhelpfulCount": len(unhelpful_ids),
        "myVote": comments_store.get_user_vote(comment["id"], requester_id) if requester_id else None,
    }


# ------------------------------------------------------------------ Votes

@interactions_bp.post("/comments/<comment_id>/vote")
@requires_auth
def vote_on_comment(comment_id):
    if not comments_store.find_comment(comment_id):
        raise ApiError(404, "Commentaire introuvable")

    data = request.get_json(force=True, silent=True) or {}
    value = data.get("value")
    if value not in VALID_VOTE_VALUES:
        raise ApiError(422, "value doit être 'helpful' ou 'unhelpful'")

    comments_store.cast_vote(comment_id, g.user["id"], value)
    return jsonify({"success": True, "data": _vote_summary(comment_id, g.user["id"])}), 200


@interactions_bp.delete("/comments/<comment_id>/vote")
@requires_auth
def unvote_comment(comment_id):
    comments_store.remove_vote(comment_id, g.user["id"])
    return jsonify({"success": True, "data": _vote_summary(comment_id, g.user["id"])}), 200


@interactions_bp.get("/comments/<comment_id>/votes")
def get_comment_votes(comment_id):
    """Détail public des votants (nom + avatar de chaque personne ayant voté)."""
    if not comments_store.find_comment(comment_id):
        raise ApiError(404, "Commentaire introuvable")

    helpful_ids, unhelpful_ids = comments_store.list_votes_for_comment(comment_id)
    identities = get_user_identities(helpful_ids + unhelpful_ids)
    return jsonify({
        "success": True,
        "data": {
            "helpful": [identities[uid] for uid in helpful_ids],
            "unhelpful": [identities[uid] for uid in unhelpful_ids],
        },
    }), 200


def _vote_summary(comment_id, requester_id):
    helpful_ids, unhelpful_ids = comments_store.list_votes_for_comment(comment_id)
    return {
        "helpfulCount": len(helpful_ids),
        "unhelpfulCount": len(unhelpful_ids),
        "myVote": comments_store.get_user_vote(comment_id, requester_id),
    }


# -------------------------------------------------------------- Favorites

@interactions_bp.post("/posts/<post_id>/favorite")
@requires_auth
def add_favorite(post_id):
    post = models.find_by_id(post_id)
    if not post:
        raise ApiError(404, "Publication introuvable")

    favorites_store.add_favorite(g.user["id"], post_id, post["city"], post["locationName"])
    return jsonify({"success": True, "data": {"isFavorited": True}}), 200


@interactions_bp.delete("/posts/<post_id>/favorite")
@requires_auth
def remove_favorite(post_id):
    favorites_store.remove_favorite(g.user["id"], post_id)
    return jsonify({"success": True, "data": {"isFavorited": False}}), 200


@interactions_bp.get("/favorites")
@requires_auth
def list_my_favorites():
    post_ids = favorites_store.list_favorite_post_ids(g.user["id"])
    posts = [models.find_by_id(pid) for pid in post_ids]
    posts = [p for p in posts if p]  # ignore les posts entre-temps supprimés
    identities = get_user_identities([p["userId"] for p in posts])
    serialized = []
    for p in posts:
        serialized.append({
            "id": p["id"], "userId": p["userId"], "city": p["city"], "locationName": p["locationName"],
            "caption": p["caption"], "visitDate": p["visitDate"], "images": p["images"], "createdAt": p["createdAt"],
            "author": identities.get(p["userId"]),
        })
    return jsonify({"success": True, "data": serialized}), 200
