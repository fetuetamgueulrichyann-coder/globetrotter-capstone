"""
Identité publique minimale (Phase 2 révisée — plus de follow/profil social).

MboaTrip n'est plus pensé comme un réseau social à profils/abonnements :
ces routes exposent juste de quoi afficher "qui" a posté une photo ou un
commentaire (nom + avatar), et permettent à chacun de modifier ses propres
infos. Aucune notion de followers/following n'existe plus ici.
"""
from flask import Blueprint, request, jsonify, g, send_from_directory

from app.config import Config
from app.errors import ApiError
from app.validators import validate_profile_update, save_avatar_image, delete_avatar_file, ImageRejected
from app import models
from app.auth import requires_auth, requires_admin

users_bp = Blueprint("users", __name__, url_prefix="/users")


@users_bp.get("/admin/stats")
@requires_admin
def admin_stats():
    return jsonify({
        "success": True,
        "data": {
            "usersCount": models.count_users(),
            "legacyUsersCount": int(models.get_setting("legacy_users_count", "0") or 0),
        },
    }), 200


@users_bp.patch("/admin/settings/legacy-users-count")
@requires_admin
def admin_set_legacy_users_count():
    data = request.get_json(force=True, silent=True) or {}
    value = data.get("count")
    if not isinstance(value, int) or value < 0:
        raise ApiError(422, "count doit être un entier positif")
    models.set_setting("legacy_users_count", str(value))
    return jsonify({"success": True, "data": {"legacyUsersCount": value}}), 200


@users_bp.get("/search")
@requires_auth
def search_users():
    """
    Recherche par nom, pour permettre à un utilisateur de retrouver un autre
    utilisateur à qui écrire (messagerie) — alternative à la découverte
    depuis le fil, au cas où celui-ci serait indisponible.
    """
    query = (request.args.get("q") or "").strip()
    if len(query) < 2:
        return jsonify({"success": True, "data": []}), 200
    results = models.search_by_name(query, exclude_id=g.user["id"])
    return jsonify({
        "success": True,
        "data": [{"id": u["id"], "name": u["name"], "avatarUrl": u.get("avatarUrl", "")} for u in results],
    }), 200


@users_bp.get("/<user_id>")
def get_public_identity(user_id):
    """
    Identité minimale d'un utilisateur, utilisée pour afficher un auteur de
    publication/commentaire ou un votant — PAS une page de profil consultable.
    """
    user = models.find_by_id(user_id)
    if not user:
        raise ApiError(404, "Utilisateur introuvable")
    return jsonify({
        "success": True,
        "data": {"id": user["id"], "name": user["name"], "avatarUrl": user.get("avatarUrl", "")},
    }), 200


@users_bp.patch("/me")
@requires_auth
def update_my_profile():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_profile_update(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    updated = models.update_profile(g.user["id"], data)
    if not updated:
        raise ApiError(404, "Utilisateur introuvable")

    return jsonify({"success": True, "data": {"user": models.sanitize(updated)}}), 200


@users_bp.post("/me/avatar")
@requires_auth
def upload_my_avatar():
    """
    Upload direct d'une photo de profil depuis les fichiers de l'utilisateur
    (multipart/form-data, champ "avatar") — alternative à la simple URL.
    """
    file = request.files.get("avatar")
    if not file or not file.filename:
        raise ApiError(422, "Aucune image envoyée", [{"field": "avatar", "message": "Choisis une image"}])

    try:
        new_avatar_url = save_avatar_image(file)
    except ImageRejected as e:
        raise ApiError(422, e.message, [{"field": "avatar", "message": e.message}])

    current = models.find_by_id(g.user["id"])
    old_avatar_url = current.get("avatarUrl") if current else None

    updated = models.update_profile(g.user["id"], {"avatarUrl": new_avatar_url})
    if not updated:
        raise ApiError(404, "Utilisateur introuvable")

    # Nettoyage de l'ancien fichier local (best-effort, ignore les URL externes)
    delete_avatar_file(old_avatar_url)

    return jsonify({"success": True, "data": {"user": models.sanitize(updated)}}), 200


@users_bp.get("/avatars/<path:filename>")
def serve_avatar(filename):
    return send_from_directory(Config.UPLOADS_DIR, filename)


@users_bp.delete("/me")
@requires_auth
def delete_my_account():
    """Suppression de compte, demandée depuis Paramètres > Données."""
    if g.user.get("role") == "admin":
        raise ApiError(403, "Le compte administrateur ne peut pas être supprimé")

    ok = models.delete_account(g.user["id"])
    if not ok:
        raise ApiError(404, "Utilisateur introuvable")

    from app.auth import _clear_auth_cookie
    response = jsonify({"success": True, "message": "Compte supprimé"})
    _clear_auth_cookie(response)
    return response, 200
