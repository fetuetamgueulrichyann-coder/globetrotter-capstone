"""
Résolution d'identité (nom + avatar) auprès du User Service, pour afficher
qui a posté une photo, écrit un commentaire, ou voté "utile".

Contrairement au patron habituel (ApiError bloquante si le service est
injoignable, cf. recommendation-service/clients.py), ces appels sont de
l'enrichissement non-critique : si le User Service a un problème, on ne
casse pas l'affichage du fil ou des commentaires, on retombe sur un nom
générique.
"""
import requests
from app.config import Config
from app import logger

TIMEOUT = 5
_FALLBACK = {"name": "Voyageur MboaTrip", "avatarUrl": ""}


def get_user_identity(user_id, _retry=True):
    """
    Un seul essai supplémentaire en cas de timeout/erreur réseau avant de
    retomber sur le nom générique — évite qu'un simple ralentissement
    passager du User Service (redémarrage de conteneur, pic de charge)
    fasse apparaître "Voyageur MboaTrip" à la place d'un vrai nom.
    """
    try:
        r = requests.get(
            f"{Config.USER_SERVICE_URL}/internal/users/{user_id}",
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY}, timeout=TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()["data"]
            return {"id": user_id, "name": data.get("name", _FALLBACK["name"]), "avatarUrl": data.get("avatarUrl", "")}
        logger.error("User Service a répondu sans succès (identité)", userId=user_id, status=r.status_code)
    except requests.RequestException as e:
        if _retry:
            return get_user_identity(user_id, _retry=False)
        logger.error("User Service injoignable (identité)", userId=user_id, error=str(e))
    return {"id": user_id, **_FALLBACK}


def get_user_identities(user_ids):
    """Résout une liste d'ids (dédupliqués) -> dict {userId: {name, avatarUrl}}."""
    unique_ids = set(user_ids)
    return {uid: get_user_identity(uid) for uid in unique_ids}
