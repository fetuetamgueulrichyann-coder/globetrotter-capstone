"""
Authentification : JWT, cookie httpOnly, décorateurs d'auth, routes
register/login/me/logout, et réinitialisation de mot de passe.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt as pyjwt
import requests
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from app.config import Config
from app.errors import ApiError
from app.validators import validate_register, validate_login
from app import models, logger
from app.events import publish_event

auth_bp = Blueprint("auth", __name__)

RESET_TOKEN_EXPIRES_MINUTES = 30


# ---------- JWT ----------

def sign_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"], "email": user["email"], "role": user["role"],
        "iat": now, "exp": now + timedelta(hours=Config.JWT_EXPIRES_IN_HOURS),
    }
    return pyjwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def verify_token(token):
    return pyjwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])


def _set_auth_cookie(response, token):
    """
    Place le JWT dans un cookie httpOnly (inaccessible à JavaScript, donc
    protégé contre le vol via une faille XSS) — remplace l'ancien stockage
    en localStorage côté frontend.
    """
    response.set_cookie(
        Config.COOKIE_NAME, token,
        httponly=True,
        secure=Config.COOKIE_SECURE,
        samesite=Config.COOKIE_SAMESITE,
        max_age=Config.JWT_EXPIRES_IN_HOURS * 3600,
        path="/",
    )
    return response


def _clear_auth_cookie(response):
    response.set_cookie(
        Config.COOKIE_NAME, "", expires=0,
        httponly=True, secure=Config.COOKIE_SECURE, samesite=Config.COOKIE_SAMESITE, path="/",
    )
    return response


def requires_auth(f):
    """
    Vérifie le JWT depuis le cookie httpOnly en priorité (flux navigateur
    normal), avec repli sur le header Authorization: Bearer (utile pour les
    tests automatisés / appels API directs type curl).
    """
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
            decoded = verify_token(token)
        except pyjwt.PyJWTError:
            raise ApiError(401, "Session invalide ou expirée")
        g.user = {"id": decoded["sub"], "email": decoded["email"], "role": decoded["role"]}
        return f(*args, **kwargs)
    return decorated


def requires_admin(f):
    """Comme requires_auth, mais exige en plus le rôle admin."""
    @wraps(f)
    @requires_auth
    def decorated(*args, **kwargs):
        if g.user.get("role") != "admin":
            raise ApiError(403, "Réservé aux administrateurs")
        return f(*args, **kwargs)
    return decorated


# ---------- Routes ----------

@auth_bp.post("/register")
def register():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_register(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    if models.find_by_email(data["email"]):
        raise ApiError(409, "Un compte existe déjà avec cet email")

    password_hash = generate_password_hash(data["password"])
    user = models.create(data["name"].strip(), data["email"], password_hash, data.get("preferences", []))
    token = sign_token(user)

    logger.info("Nouvel utilisateur inscrit", userId=user["id"])
    publish_event("user.registered", {"userId": user["id"], "email": user["email"]})

    resp = jsonify({"success": True, "data": {"user": models.sanitize(user)}})
    return _set_auth_cookie(resp, token), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    errors = validate_login(data)
    if errors:
        raise ApiError(422, "Données invalides", errors)

    found = models.find_by_email(data["email"])
    if not found or not found.get("passwordHash") or not check_password_hash(found["passwordHash"], data["password"]):
        raise ApiError(401, "Email ou mot de passe incorrect")

    token = sign_token(found)
    resp = jsonify({"success": True, "data": {"user": models.sanitize(found)}})
    return _set_auth_cookie(resp, token), 200


@auth_bp.post("/admin/login")
def admin_login():
    """
    Connexion admin séparée de la connexion publique (par nom, pas par
    email) — évite d'exposer l'accès admin via le même formulaire que les
    utilisateurs normaux.
    """
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""
    if not name or not password:
        raise ApiError(422, "Nom et mot de passe requis")

    found = models.find_by_name_and_role(name, "admin")
    if not found or not found.get("passwordHash") or not check_password_hash(found["passwordHash"], password):
        raise ApiError(401, "Identifiants administrateur incorrects")

    token = sign_token(found)
    resp = jsonify({"success": True, "data": {"user": models.sanitize(found)}})
    logger.info("Connexion administrateur", userId=found["id"])
    return _set_auth_cookie(resp, token), 200


@auth_bp.post("/auth/google")
def google_login():
    """
    Connexion via Google Identity Services : le frontend obtient un jeton
    d'identité (ID token) directement de Google (bouton "Se connecter avec
    Google"), puis l'envoie ici. On le fait vérifier par Google lui-même
    (endpoint tokeninfo) — cette approche ne nécessite aucun secret côté
    serveur, seulement le Client ID, déjà public de toute façon (visible
    dans le bouton). Simple et sûr : la vérification de signature reste
    entièrement du côté de Google.
    """
    data = request.get_json(force=True, silent=True) or {}
    credential = data.get("credential")
    if not credential:
        raise ApiError(422, "credential (ID token Google) requis")

    try:
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException:
        raise ApiError(502, "Le service Google est temporairement indisponible")

    if payload.get("aud") != Config.GOOGLE_CLIENT_ID:
        raise ApiError(401, "Jeton Google invalide pour cette application")
    if payload.get("email_verified") not in ("true", True):
        raise ApiError(401, "Cette adresse Google n'est pas vérifiée")

    google_id = payload["sub"]
    email = payload["email"]
    name = payload.get("name") or email.split("@")[0]

    user = models.find_by_google_id(google_id)
    if not user:
        existing_by_email = models.find_by_email(email)
        if existing_by_email:
            user = models.link_google_id(existing_by_email["id"], google_id)
        else:
            user = models.create_from_google(name, email, google_id)
            publish_event("user.registered", {"userId": user["id"], "email": user["email"], "via": "google"})

    token = sign_token(user)
    resp = jsonify({"success": True, "data": {"user": models.sanitize(user)}})
    logger.info("Connexion via Google", userId=user["id"])
    return _set_auth_cookie(resp, token), 200


@auth_bp.get("/me")
@requires_auth
def get_profile():
    found = models.find_by_id(g.user["id"])
    if not found:
        raise ApiError(404, "Utilisateur introuvable")
    return jsonify({"success": True, "data": {"user": models.sanitize(found)}}), 200


@auth_bp.post("/logout")
@requires_auth
def logout():
    resp = jsonify({"success": True, "message": "Déconnexion réussie"})
    return _clear_auth_cookie(resp), 200


# ---------- Réinitialisation de mot de passe ----------

@auth_bp.post("/forgot-password")
def forgot_password():
    """
    Génère un token de réinitialisation à usage unique (valide 30 min).
    ⚠️ Aucun service d'envoi d'email n'est configuré dans ce projet : en
    l'absence d'identifiants SMTP, le lien est renvoyé directement dans la
    réponse JSON (mode démo), au lieu d'être envoyé par email comme en
    production. Le token n'est jamais stocké en clair (seul son hash SHA-256
    est conservé côté serveur).
    """
    data = request.get_json(force=True, silent=True) or {}
    email = data.get("email", "")

    user = models.find_by_email(email)
    # Réponse volontairement identique que l'email existe ou non, pour ne
    # pas révéler si une adresse est enregistrée (anti-énumération de comptes).
    generic_response = {
        "success": True,
        "message": "Si un compte existe avec cet email, un lien de réinitialisation a été généré.",
    }

    if not user:
        return jsonify(generic_response), 200

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRES_MINUTES)).isoformat()
    models.set_reset_token(user["id"], token_hash, expires_at)

    logger.info("Token de réinitialisation généré", userId=user["id"])

    # ⚠️ Mode démo uniquement : en production, `raw_token` serait envoyé par
    # email et jamais renvoyé dans la réponse HTTP.
    generic_response["devResetToken"] = raw_token
    generic_response["devNote"] = "Aucun service email configuré — lien affiché ici en mode démo uniquement."
    return jsonify(generic_response), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(force=True, silent=True) or {}
    raw_token = data.get("token", "")
    new_password = data.get("password", "")

    if not raw_token or not new_password:
        raise ApiError(422, "Token et nouveau mot de passe requis")
    if len(new_password) < 8:
        raise ApiError(422, "Le mot de passe doit contenir au moins 8 caractères",
                        [{"field": "password", "message": "8 caractères minimum"}])

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    user = models.find_by_reset_token_hash(token_hash)

    if not user:
        raise ApiError(400, "Lien de réinitialisation invalide")

    expires_at = user.get("resetTokenExpiresAt")
    if not expires_at or datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        raise ApiError(400, "Ce lien de réinitialisation a expiré, refaites une demande")

    new_hash = generate_password_hash(new_password)
    models.update_password(user["id"], new_hash)
    logger.info("Mot de passe réinitialisé", userId=user["id"])

    return jsonify({"success": True, "message": "Mot de passe mis à jour, vous pouvez vous connecter"}), 200


@auth_bp.post("/change-password")
@requires_auth
def change_password():
    """
    Changement de mot de passe depuis les Paramètres, pour un utilisateur
    déjà connecté — distinct du parcours "mot de passe oublié" (qui ne
    nécessite pas de connaître l'ancien mot de passe).
    """
    data = request.get_json(force=True, silent=True) or {}
    current_password = data.get("currentPassword", "")
    new_password = data.get("newPassword", "")

    if not current_password or not new_password:
        raise ApiError(422, "Mot de passe actuel et nouveau mot de passe requis")
    if len(new_password) < 8:
        raise ApiError(422, "Le nouveau mot de passe doit contenir au moins 8 caractères",
                        [{"field": "newPassword", "message": "8 caractères minimum"}])

    user = models.find_by_id(g.user["id"])
    if not user or not user.get("passwordHash") or not check_password_hash(user["passwordHash"], current_password):
        raise ApiError(401, "Mot de passe actuel incorrect")

    models.update_password(user["id"], generate_password_hash(new_password))
    logger.info("Mot de passe changé depuis les paramètres", userId=user["id"])
    return jsonify({"success": True, "message": "Mot de passe mis à jour"}), 200


# ---------- Routes INTERNES (service-à-service uniquement) ----------

def _requires_internal_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-Internal-Key")
        if key != Config.INTERNAL_API_KEY:
            raise ApiError(403, "Clé interne invalide")
        return f(*args, **kwargs)
    return decorated


@auth_bp.get("/internal/users/<user_id>")
@_requires_internal_key
def internal_get_user(user_id):
    found = models.find_by_id(user_id)
    if not found:
        raise ApiError(404, "Utilisateur introuvable")
    return jsonify({"success": True, "data": models.sanitize(found)}), 200


@auth_bp.get("/internal/users/by-email")
@_requires_internal_key
def internal_get_user_by_email():
    email = request.args.get("email")
    if not email:
        raise ApiError(422, "email requis")
    found = models.find_by_email(email)
    if not found:
        raise ApiError(404, "Utilisateur introuvable")
    return jsonify({"success": True, "data": models.sanitize(found)}), 200
