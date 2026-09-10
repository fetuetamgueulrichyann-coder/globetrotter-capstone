"""
Alertes communautaires hyper-locales : état des routes, prix qui grimpent,
lieu fermé — signalées par les utilisateurs eux-mêmes. L'idée : là où
Google Maps Cameroun est souvent périmé, MboaTrip reste à jour grâce à sa
communauté.
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, g
from app.db import get_session
from app.db_models import LocalAlertRow
from app.auth_middleware import requires_auth
from app.errors import ApiError
from app.clients import get_user_identities

alerts_bp = Blueprint("alerts", __name__, url_prefix="/alerts")

ALERT_TYPES = ("route", "price", "closed", "other")
# Une alerte n'a de sens que si elle est récente — au-delà, elle n'apparaît
# plus (mais reste en base pour un éventuel historique/modération admin).
ALERT_MAX_AGE_DAYS = 14


def _to_dict(row):
    return {
        "id": row.id, "userId": row.user_id, "city": row.city, "placeName": row.place_name,
        "type": row.alert_type, "message": row.message,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


@alerts_bp.get("")
def list_alerts():
    city = request.args.get("city")
    cutoff = datetime.now(timezone.utc) - timedelta(days=ALERT_MAX_AGE_DAYS)
    with get_session() as s:
        q = s.query(LocalAlertRow).filter(LocalAlertRow.created_at >= cutoff)
        if city:
            q = q.filter(LocalAlertRow.city == city)
        rows = q.order_by(LocalAlertRow.created_at.desc()).limit(50).all()
        alerts = [_to_dict(r) for r in rows]

    author_ids = {a["userId"] for a in alerts}
    identities = get_user_identities(list(author_ids))
    data = [{**a, "author": identities.get(a["userId"])} for a in alerts]
    return jsonify({"success": True, "data": data}), 200


@alerts_bp.post("")
@requires_auth
def create_alert():
    data = request.get_json(force=True, silent=True) or {}
    city = (data.get("city") or "").strip()
    alert_type = data.get("type")
    message = (data.get("message") or "").strip()
    place_name = (data.get("placeName") or "").strip()

    if not city:
        raise ApiError(422, "city requis")
    if alert_type not in ALERT_TYPES:
        raise ApiError(422, f"type doit être l'un de : {', '.join(ALERT_TYPES)}")
    if not message or len(message) > 300:
        raise ApiError(422, "message requis (max 300 caractères)")

    with get_session() as s:
        row = LocalAlertRow(user_id=g.user["id"], city=city, place_name=place_name, alert_type=alert_type, message=message)
        s.add(row)
        s.flush()
        result = _to_dict(row)
    return jsonify({"success": True, "data": result}), 201


@alerts_bp.delete("/<alert_id>")
@requires_auth
def delete_alert(alert_id):
    is_admin = g.user.get("role") == "admin"
    with get_session() as s:
        row = s.get(LocalAlertRow, alert_id)
        if not row:
            raise ApiError(404, "Alerte introuvable")
        if row.user_id != g.user["id"] and not is_admin:
            raise ApiError(403, "Tu ne peux supprimer que tes propres alertes")
        s.delete(row)
    return jsonify({"success": True, "message": "Alerte supprimée"}), 200
