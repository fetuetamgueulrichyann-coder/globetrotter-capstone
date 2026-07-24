"""
Recommandations personnalisées : scoring basé sur préférences utilisateur,
historique (exclusion des destinations déjà planifiées) et popularité globale.
"""
from flask import Blueprint, jsonify, g
from app import models
from app.auth import requires_auth

recommendations_bp = Blueprint("recommendations", __name__, url_prefix="/api/recommendations")


@recommendations_bp.get("")
@requires_auth
def get_recommendations():
    current_user = models.find_user_by_id(g.user["id"])
    all_destinations = models.find_all_destinations()
    user_itineraries = models.find_itineraries_by_user(g.user["id"])

    visited_ids = {it["destinationId"] for it in user_itineraries}
    preferred_tags = {p.lower() for p in (current_user.get("preferences") or [])}

    scored = []
    for d in all_destinations:
        if d["id"] in visited_ids:
            continue
        tag_matches = len([t for t in d["tags"] if t.lower() in preferred_tags])
        score = tag_matches * 20 + d["popularity"] * 0.3
        scored.append({**d, "matchScore": round(score)})

    scored.sort(key=lambda d: d["matchScore"], reverse=True)
    scored = scored[:10]

    return jsonify({
        "success": True,
        "data": scored,
        "meta": {
            "basedOnPreferences": list(preferred_tags),
            "excludedAlreadyPlanned": len(visited_ids),
        },
    }), 200
