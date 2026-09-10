"""
Vérification JWT locale : chaque service vérifie le token lui-même avec
le secret partagé, sans appeler le User Service à chaque requête.

Le JWT est lu depuis le cookie httpOnly en priorité (flux navigateur
normal), avec repli sur le header Authorization: Bearer.
"""
from functools import wraps
import jwt as pyjwt
from flask import request, g
from app.config import Config
from app.errors import ApiError


def _extract_token():
    token = request.cookies.get(Config.COOKIE_NAME)
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header.split(" ", 1)[1]
    return token


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            raise ApiError(401, "Authentification requise")
        try:
            decoded = pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        except pyjwt.PyJWTError:
            raise ApiError(401, "Session invalide ou expirée")
        g.user = {"id": decoded["sub"], "email": decoded["email"], "role": decoded["role"]}
        return f(*args, **kwargs)
    return decorated


def optional_auth():
    """Renvoie l'id utilisateur si un token valide est présent, sinon None (jamais d'erreur)."""
    token = _extract_token()
    if not token:
        return None
    try:
        return pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])["sub"]
    except pyjwt.PyJWTError:
        return None
