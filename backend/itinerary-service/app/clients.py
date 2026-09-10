"""Appels internes vers user-service pour afficher nom/avatar (dépenses partagées)."""
import requests
from app.config import Config


def get_user_identity(user_id):
    try:
        resp = requests.get(
            f"{Config.USER_SERVICE_URL}/internal/users/{user_id}",
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        u = resp.json()["data"]
        return {"id": u["id"], "name": u["name"], "avatarUrl": u.get("avatarUrl", "")}
    except requests.RequestException:
        return None


def get_user_identities(user_ids):
    return {uid: get_user_identity(uid) for uid in set(user_ids)}
