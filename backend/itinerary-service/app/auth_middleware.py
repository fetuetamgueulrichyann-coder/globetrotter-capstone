"""
Vérification JWT locale : chaque service vérifie le token lui-même
avec le secret partagé, sans appeler le User Service à chaque requête
(évite un appel réseau synchrone supplémentaire sur le chemin critique).

Le JWT est lu depuis le cookie httpOnly en priorité (flux navigateur
normal, cookie transmis tel quel par le Gateway), avec repli sur le header
Authorization: Bearer (tests automatisés / appels API directs).
"""
from functools import wraps
import jwt as pyjwt
from flask import request, g
from app.config import Config
from app.errors import ApiError


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get(Config.COOKIE_NAME)
        if not token:
            header = request.headers.get("Authorization", "")
            if header.startswith("Bearer "):
                token = header.split(" ", 1)[1]

        if not token:
            raise ApiError(401, "Authentification requise")
        try:
            decoded = pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        except pyjwt.PyJWTError:
            raise ApiError(401, "Session invalide ou expirée")
        g.user = {"id": decoded["sub"], "email": decoded["email"], "role": decoded["role"]}
        return f(*args, **kwargs)
    return decorated


def requires_admin(f):
    """Comme requires_auth, mais exige en plus le rôle admin (édition des POI/photos)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get(Config.COOKIE_NAME)
        if not token:
            header = request.headers.get("Authorization", "")
            if header.startswith("Bearer "):
                token = header.split(" ", 1)[1]
        if not token:
            raise ApiError(401, "Authentification requise")
        try:
            decoded = pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        except pyjwt.PyJWTError:
            raise ApiError(401, "Session invalide ou expirée")
        if decoded.get("role") != "admin":
            raise ApiError(403, "Réservé aux administrateurs")
        g.user = {"id": decoded["sub"], "email": decoded["email"], "role": decoded["role"]}
        return f(*args, **kwargs)
    return decorated


def requires_internal_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.headers.get("X-Internal-Key") != Config.INTERNAL_API_KEY:
            raise ApiError(403, "Clé interne invalide")
        return f(*args, **kwargs)
    return decorated
