"""Configuration centralisée du User Service."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SERVICE_NAME = "user-service"
    PORT = int(os.environ.get("PORT", 5001))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    # IMPORTANT : doit être IDENTIQUE dans les 4 services (gateway compris),
    # sinon la vérification JWT échoue d'un service à l'autre.
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    # Durée réduite (24h) par rapport à l'ancienne valeur (7 jours) — limite
    # la fenêtre d'exploitation en cas de token compromis.
    JWT_EXPIRES_IN_HOURS = int(os.environ.get("JWT_EXPIRES_IN_HOURS", 24))

    # Le JWT est désormais transporté via un cookie httpOnly (inaccessible à
    # JavaScript, donc protégé contre le vol par une faille XSS) plutôt que
    # stocké côté client dans localStorage. SameSite=None + Secure=True
    # fonctionne même en HTTP local car les navigateurs modernes traitent
    # "localhost" comme un contexte sécurisé — mais ça exige d'utiliser
    # littéralement "localhost" (pas 127.0.0.1) côté frontend ET backend.
    COOKIE_NAME = "mboatrip_token"
    COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "None")

    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",")]

    RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_only_internal_key")
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://mboatrip:change_this_password@localhost:5432/mboatrip")

    # Upload de photo de profil
    UPLOADS_DIR = BASE_DIR / "uploads"
    ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
    MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024  # 4 Mo
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024     # garde-fou global Flask

    # Compte administrateur (créé automatiquement au premier démarrage si
    # absent — voir db.py:_seed_admin_if_missing). Le mot de passe n'est
    # JAMAIS stocké en clair, même ici : seule cette valeur de démarrage
    # transite par l'env, elle est hachée avant d'entrer en base.
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@gmail.com")
    ADMIN_SEED_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD", "@Yann1234")

    # Connexion Google (Google Identity Services — vérification par ID
    # token, aucun secret serveur nécessaire).
    GOOGLE_CLIENT_ID = os.environ.get(
        "GOOGLE_CLIENT_ID",
        "857814601767-2d36ai64gmn8d5qtraeq6f9do7cv3fbi.apps.googleusercontent.com",
    )
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
