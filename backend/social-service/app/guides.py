"""
Répertoire de guides locaux vérifiés — mise en relation directe (téléphone),
pas de réservation en ligne pour l'instant. Ajout/suppression réservés à
l'admin, pour garantir que ce sont de vraies personnes vérifiées et pas
n'importe qui qui se déclare "guide".
"""
from flask import Blueprint, request, jsonify, g
from app.db import get_session
from app.db_models import LocalGuideRow
from app.auth_middleware import requires_auth
from app.errors import ApiError

guides_bp = Blueprint("guides", __name__, url_prefix="/guides")


def _to_dict(row):
    return {
        "id": row.id, "name": row.name, "phone": row.phone, "city": row.city,
        "specialty": row.specialty, "bio": row.bio, "photoUrl": row.photo_url,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


@guides_bp.get("")
def list_guides():
    city = request.args.get("city")
    with get_session() as s:
        q = s.query(LocalGuideRow)
        if city:
            q = q.filter(LocalGuideRow.city == city)
        rows = q.order_by(LocalGuideRow.created_at.desc()).all()
        return jsonify({"success": True, "data": [_to_dict(r) for r in rows]}), 200


@guides_bp.post("/admin")
@requires_auth
def admin_create_guide():
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    city = (data.get("city") or "").strip()
    if not name or not phone or not city:
        raise ApiError(422, "name, phone et city sont requis")

    with get_session() as s:
        row = LocalGuideRow(
            name=name, phone=phone, city=city,
            specialty=data.get("specialty", ""), bio=data.get("bio", ""), photo_url=data.get("photoUrl", ""),
        )
        s.add(row)
        s.flush()
        result = _to_dict(row)
    return jsonify({"success": True, "data": result}), 201


@guides_bp.delete("/admin/<guide_id>")
@requires_auth
def admin_delete_guide(guide_id):
    if g.user.get("role") != "admin":
        raise ApiError(403, "Réservé aux administrateurs")
    with get_session() as s:
        row = s.get(LocalGuideRow, guide_id)
        if not row:
            raise ApiError(404, "Guide introuvable")
        s.delete(row)
    return jsonify({"success": True, "message": "Guide supprimé"}), 200
