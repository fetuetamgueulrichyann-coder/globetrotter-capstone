"""
API Gateway : point d'entrée UNIQUE pour les clients (frontend).
Route chaque requête vers le bon microservice selon le chemin,
sans que le client ait jamais besoin de connaître leurs adresses
internes (user-service:5001, itinerary-service:5002, etc.).

Centralise aussi : CORS, rate limiting, health check agrégé.
"""
import os
from datetime import datetime, timezone

import requests
import jwt as pyjwt
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
COOKIE_NAME = "mboatrip_token"
USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://user-service:5001")
ITINERARY_SERVICE_URL = os.environ.get("ITINERARY_SERVICE_URL", "http://itinerary-service:5002")
RECOMMENDATION_SERVICE_URL = os.environ.get("RECOMMENDATION_SERVICE_URL", "http://recommendation-service:5003")
SOCIAL_SERVICE_URL = os.environ.get("SOCIAL_SERVICE_URL", "http://social-service:5004")
MESSAGING_SERVICE_URL = os.environ.get("MESSAGING_SERVICE_URL", "http://messaging-service:5005")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:5173").split(",")]
PORT = int(os.environ.get("PORT", 8000))
DEBUG = os.environ.get("FLASK_ENV", "development") == "development"

# Table de routage : préfixe de chemin -> service cible
ROUTES = [
    (
        ("/register", "/login", "/me", "/logout", "/forgot-password", "/reset-password", "/change-password", "/users", "/auth"),
        USER_SERVICE_URL,
    ),
    (("/destinations", "/itineraries"), ITINERARY_SERVICE_URL),
    (("/recommendations",), RECOMMENDATION_SERVICE_URL),
    (("/posts", "/uploads", "/comments", "/favorites", "/places", "/alerts", "/guides", "/place-suggestions"), SOCIAL_SERVICE_URL),
    # Messagerie : le REST (historique, liste, envoi) passe par le gateway
    # comme le reste. Seule la connexion WebSocket temps réel se fait en
    # direct vers messaging-service (voir docker-compose.yml et lib/socket.ts
    # côté frontend) — un simple proxy HTTP par requête ne sait pas relayer
    # une connexion WebSocket persistante.
    (("/conversations",), MESSAGING_SERVICE_URL),
]

app = Flask(__name__)
CORS(app, origins=CORS_ORIGINS, supports_credentials=True)
# Limite par adresse IP, tous appels API confondus (pas seulement les
# messages). Une conversation active génère beaucoup plus de requêtes que
# l'ancienne limite (300/15min) ne le supposait — surtout que la
# messagerie recharge la liste des conversations après chaque envoi/
# réception. Relevée nettement pour ne jamais bloquer un usage normal, tout
# en gardant une protection basique contre un script qui spammerait l'API.
limiter = Limiter(key_func=get_remote_address, default_limits=["3000 per 15 minutes"])
limiter.init_app(app)
auth_limiter_paths = {"/register", "/login"}


def _is_authenticated_admin():
    """
    Exempte le compte administrateur du rate limiting du gateway — utile
    car un admin qui gère l'app (upload de photos en série, modération...)
    peut légitimement dépasser la limite pensée pour un usage normal. Se
    base sur le rôle porté par le JWT (cookie httpOnly), jamais sur une
    simple IP, donc ne profite qu'au compte admin réellement connecté.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        return False
    try:
        decoded = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded.get("role") == "admin"
    except pyjwt.PyJWTError:
        return False


@limiter.request_filter
def exempt_admin_from_rate_limit():
    return _is_authenticated_admin()


def _target_service(path):
    for prefixes, service_url in ROUTES:
        for prefix in prefixes:
            if path == prefix or path.startswith(prefix + "/"):
                return service_url
    return None


@app.get("/health")
def health():
    """Health check agrégé : interroge les 3 services et remonte leur statut."""
    services = {
        "user-service": USER_SERVICE_URL,
        "itinerary-service": ITINERARY_SERVICE_URL,
        "recommendation-service": RECOMMENDATION_SERVICE_URL,
        "social-service": SOCIAL_SERVICE_URL,
        "messaging-service": MESSAGING_SERVICE_URL,
    }
    statuses = {}
    all_ok = True
    for name, url in services.items():
        try:
            r = requests.get(f"{url}/health", timeout=2)
            statuses[name] = "ok" if r.status_code == 200 else "unhealthy"
            if r.status_code != 200:
                all_ok = False
        except requests.RequestException:
            statuses[name] = "unreachable"
            all_ok = False

    return jsonify({
        "success": all_ok,
        "gateway": "ok",
        "services": statuses,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200 if all_ok else 503


@app.route("/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy(path):
    full_path = f"/{path}"
    target = _target_service(full_path)

    if not target:
        return jsonify({"success": False, "error": {"message": "Route non trouvée"}}), 404

    # Rate limit renforcé sur les routes d'authentification (anti brute-force)
    if full_path in auth_limiter_paths:
        pass  # Limiter appliqué globalement ; un limiter dédié pourrait être ajouté ici si besoin

    url = f"{target}{full_path}"
    try:
        resp = requests.request(
            method=request.method,
            url=url,
            headers={k: v for k, v in request.headers if k.lower() != "host"},
            params=request.args,
            data=request.get_data(),
            timeout=10,
            # Essentiel pour les flux OAuth (ex. connexion Facebook) : une
            # redirection 3xx renvoyée par un microservice (vers Facebook,
            # ou vers le frontend après connexion) doit être transmise telle
            # quelle au navigateur, jamais suivie côté serveur par le
            # gateway lui-même — sinon le navigateur ne serait jamais
            # redirigé et recevrait à la place le contenu de la page cible.
            allow_redirects=False,
        )
    except requests.RequestException:
        return jsonify({"success": False, "error": {"message": "Service temporairement indisponible"}}), 503

    excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    headers = [(k, v) for k, v in resp.raw.headers.items() if k.lower() not in excluded_headers] \
        if hasattr(resp, "raw") and resp.raw else [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded_headers]

    return Response(resp.content, status=resp.status_code, headers=headers)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
