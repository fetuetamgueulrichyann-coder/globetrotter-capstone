from flask import Blueprint, jsonify, g
from app import clients, cache
from app.auth_middleware import requires_auth

recommendations_bp = Blueprint("recommendations", __name__)


@recommendations_bp.get("/recommendations")
@requires_auth
def get_recommendations():
    user_id = g.user["id"]

    cached = cache.get(user_id)
    if cached:
        return jsonify({"success": True, "data": cached["data"], "meta": {**cached["meta"], "cached": True}}), 200

    user = clients.get_user(user_id)
    all_destinations = clients.get_all_destinations()
    user_itineraries = clients.get_user_itineraries(user_id)

    visited_ids = {it["destinationId"] for it in user_itineraries}
    preferred_tags = {p.lower() for p in (user.get("preferences") or [])}

    scored = []
    for d in all_destinations:
        if d["id"] in visited_ids:
            continue
        tag_matches = len([t for t in d["tags"] if t.lower() in preferred_tags])
        score = tag_matches * 20 + d["popularity"] * 0.3
        scored.append({**d, "matchScore": round(score)})

    scored.sort(key=lambda d: d["matchScore"], reverse=True)
    scored = scored[:10]

    meta = {"basedOnPreferences": list(preferred_tags), "excludedAlreadyPlanned": len(visited_ids), "cached": False}
    cache.set(user_id, scored, meta)

    return jsonify({"success": True, "data": scored, "meta": meta}), 200
