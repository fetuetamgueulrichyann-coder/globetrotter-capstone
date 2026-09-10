"""Configuration centralisée du Messaging Service."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SERVICE_NAME = "messaging-service"
    PORT = int(os.environ.get("PORT", 5005))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    COOKIE_NAME = "mboatrip_token"
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",")]

    INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_only_internal_key")
    USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://localhost:5001")
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://mboatrip:change_this_password@localhost:5432/mboatrip")

    MAX_MESSAGE_LENGTH = 4000

    UPLOADS_DIR = BASE_DIR / "uploads"
    MAX_VOICE_MESSAGE_SECONDS = 120
    MAX_VOICE_MESSAGE_BYTES = 8 * 1024 * 1024  # 8 Mo, largement suffisant pour 2 min d'audio compressé
