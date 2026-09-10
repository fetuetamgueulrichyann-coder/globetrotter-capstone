"""
Suggestion de lieu par les utilisateurs : "je veux qu'on ajoute tel endroit".

POST   /place-suggestions            envoi (auth, multipart/form-data : name, city, description, photo)
GET    /place-suggestions/mine       mes propres suggestions et leur statut (auth)
GET    /place-suggestions/admin      liste complète pour modération (admin)
PATCH  /place-suggestions/<id>       change le statut : approved | rejected (admin)
"""
from flask import Blueprint, request, jsonify, g
from app.db import get_session
from app.db_models import PlaceSuggestionRow
from app.auth_middleware import requires_auth
from app.errors import ApiError
from app.clients import get_user_identities
from app.validators import save_uploaded_images, ImageRejected

place_suggestions_bp = Blueprint("place_suggestions", __name__, url_prefix="/place-suggestions")

STATUSES = ("pending", "approved", "rejected")


def _to_dict(row):
    return {
        "id": row.id, "userId": row.user_id, "name": row.name, "city": row.city or "",
        "description": row.description, "photoUrl": row.photo_url or "",
        "status": row.status, "adminNote": row.admin_note or "",
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


@place_suggestions_bp.post("")
@requires_auth
def submit_suggestion():
    name = (request.form.get("name") or "").strip()
    city = (request.form.get("city") or "").strip()
    description = (request.form.get("description") or "").strip()

    if not (2 <= len(name) <= 150):
        raise ApiError(422, "Le nom du lieu doit contenir entre 2 et 150 caractères",
                        [{"field": "name", "message": "2 à 150 caractères"}])
    if not (10 <= len(description) <= 800):
        raise ApiError(422, "La description doit contenir entre 10 et 800 caractères",
                        [{"field": "description", "message": "10 à 800 caractères"}])

    photo_url = ""
    photo = request.files.get("photo")
    if photo and photo.filename:
        try:
            saved = save_uploaded_images([photo])
            photo_url = saved[0] if saved else ""
        except ImageRejected as e:
            raise ApiError(422, e.message, [{"field": "photo", "message": e.message}])

    with get_session() as s:
        row = PlaceSuggestionRow(
            user_id=g.user["id"], name=name, city=city, description=description, photo_url=photo_url,
        )
        s.add(row)
        s.flush()
        result = _to_dict(row)
    return jsonify({"success": True, "data": result}), 201


@place_suggestions_bp.get("/mine")
@requires_auth
def list_my_suggestions():
    with get_session() as s:
        rows = (
            s.query(PlaceSuggestionRow)
            .filter_by(user_id=g.user["id"])
            .order_by(PlaceSuggestionRow.created_at.desc())
            .all()
        )
        data = [_to_dict(r) for r in rows]
    return jsonify({"success": True, "data": data}), 200


@place_suggestions_bp.get("/admin")
@requires_auth
def admin_list_suggestions():
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    status = request.args.get("status")
    with get_session() as s:
        q = s.query(PlaceSuggestionRow)
        if status:
            q = q.filter_by(status=status)
        rows = q.order_by(PlaceSuggestionRow.created_at.desc()).all()
        suggestions = [_to_dict(r) for r in rows]

    author_ids = {sug["userId"] for sug in suggestions}
    identities = get_user_identities(list(author_ids))
    data = [{**sug, "author": identities.get(sug["userId"])} for sug in suggestions]
    return jsonify({"success": True, "data": data}), 200


@place_suggestions_bp.patch("/<suggestion_id>")
@requires_auth
def admin_update_suggestion(suggestion_id):
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    data = request.get_json(force=True, silent=True) or {}
    status = data.get("status")
    if status not in ("approved", "rejected"):
        raise ApiError(422, "status doit être 'approved' ou 'rejected'")

    with get_session() as s:
        row = s.get(PlaceSuggestionRow, suggestion_id)
        if not row:
            raise ApiError(404, "Suggestion introuvable")
        row.status = status
        row.admin_note = (data.get("adminNote") or "").strip()[:300]
        s.flush()
        result = _to_dict(row)
    return jsonify({"success": True, "data": result}), 200
