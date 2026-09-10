"""
Communication SYNCHRONE (REST) avec les autres services.
Le Recommendation Service ne stocke aucune donnée métier : il lit
en temps réel les préférences (User Service) et le catalogue +
l'historique (Itinerary Service) pour calculer les recommandations.
"""
import requests
from app.config import Config
from app.errors import ApiError
from app import logger

TIMEOUT = 5


def get_user(user_id):
    try:
        r = requests.get(
            f"{Config.USER_SERVICE_URL}/internal/users/{user_id}",
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY}, timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error("User Service injoignable", error=str(e))
        raise ApiError(503, "User Service indisponible, réessayez plus tard")

    if r.status_code == 404:
        raise ApiError(404, "Utilisateur introuvable")
    if r.status_code != 200:
        raise ApiError(502, "Réponse inattendue du User Service")
    return r.json()["data"]


def get_all_destinations():
    try:
        r = requests.get(
            f"{Config.ITINERARY_SERVICE_URL}/internal/destinations",
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY}, timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error("Itinerary Service injoignable", error=str(e))
        raise ApiError(503, "Itinerary Service indisponible, réessayez plus tard")

    if r.status_code != 200:
        raise ApiError(502, "Réponse inattendue de l'Itinerary Service")
    return r.json()["data"]


def get_user_itineraries(user_id):
    try:
        r = requests.get(
            f"{Config.ITINERARY_SERVICE_URL}/internal/itineraries",
            params={"userId": user_id},
            headers={"X-Internal-Key": Config.INTERNAL_API_KEY}, timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        logger.error("Itinerary Service injoignable", error=str(e))
        raise ApiError(503, "Itinerary Service indisponible, réessayez plus tard")

    if r.status_code != 200:
        raise ApiError(502, "Réponse inattendue de l'Itinerary Service")
    return r.json()["data"]
