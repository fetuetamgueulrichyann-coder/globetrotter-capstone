"""Configuration centralisée du Social Service."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SERVICE_NAME = "social-service"
    PORT = int(os.environ.get("PORT", 5004))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    COOKIE_NAME = "mboatrip_token"
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",")]

    UPLOADS_DIR = BASE_DIR / "uploads"

    RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_only_internal_key")
    USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://localhost:5001")
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://mboatrip:change_this_password@localhost:5432/mboatrip")

    # Villes couvertes par MboaTrip — toute autre valeur est rejetée (Section 5 du brief).
    # Kribi et Yaoundé sont ouvertes au fil de publications par anticipation (avant
    # d'avoir leur propre page région), pour commencer à collecter du contenu communautaire.
    ALLOWED_CITIES = ("Bandjoun", "Bafoussam", "Douala", "Kribi", "Yaoundé")

    # Upload de photos
    ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
    MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024        # 5 Mo par photo
    MAX_IMAGES_PER_POST = 6
    MAX_CONTENT_LENGTH = 30 * 1024 * 1024         # 30 Mo par requête (garde-fou global Flask)
