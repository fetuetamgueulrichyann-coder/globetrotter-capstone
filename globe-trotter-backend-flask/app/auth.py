"""
Tout ce qui concerne l'authentification :
- signature/vérification JWT
- décorateurs requires_auth / requires_role
- routes register / login / me / logout
"""
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt as pyjwt
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from app.config import Config
from app.errors import ApiError
from app.validators import validate_register, validate_login
from app import models, logger

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ---------- JWT ----------

def sign_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(hours=Config.JWT_EXPIRES_IN_HOURS),
    }
    return pyjwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def verify_token(token):
    return pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])


# ---------- Décorateurs ----------

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Token d'authentification manquant")
        token = header.split(" ", 1)[1]
        try:
            decoded = verify_token(token)
        except pyjwt.PyJWTError:
            raise ApiError(401, "Token invalide ou expiré")
        g.user = {"id": decoded["sub"], "email": decoded["email"], "role": decoded["role"]}
        return f(*args, **kwargs)

    return decorated


def requires_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not getattr(g, "user", None) or g.user["role"] not in roles:
                raise ApiError(403, "Accès refusé : permissions insuffisantes")
            return f(*args, **kwargs)

        return decorated

    return decorator


# ---------- Routes ----------

@auth_bp.post("/register")
def register():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_register(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    if models.find_user_by_email(data["email"]):
        raise ApiError(409, "Un compte existe déjà avec cet email")

    password_hash = generate_password_hash(data["password"])
    new_user = models.create_user(
        name=data["name"].strip(),
        email=data["email"],
        password_hash=password_hash,
        preferences=data.get("preferences", []),
    )

    token = sign_token(new_user)
    logger.info("Nouvel utilisateur inscrit", userId=new_user["id"])

    return jsonify({"success": True, "data": {"user": models.sanitize_user(new_user), "token": token}}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_login(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    found = models.find_user_by_email(data["email"])
    if not found or not check_password_hash(found["passwordHash"], data["password"]):
        raise ApiError(401, "Email ou mot de passe incorrect")

    token = sign_token(found)
    return jsonify({"success": True, "data": {"user": models.sanitize_user(found), "token": token}}), 200


@auth_bp.get("/me")
@requires_auth
def get_profile():
    found = models.find_user_by_id(g.user["id"])
    if not found:
        raise ApiError(404, "Utilisateur introuvable")
    return jsonify({"success": True, "data": {"user": models.sanitize_user(found)}}), 200


@auth_bp.post("/logout")
@requires_auth
def logout():
    # JWT stateless : le logout est géré côté client (suppression du token).
    return jsonify({"success": True, "message": "Déconnexion réussie"}), 200
