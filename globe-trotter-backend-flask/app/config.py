"""Configuration centralisée de l'application Flask."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    PORT = int(os.environ.get("PORT", 4000))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    JWT_EXPIRES_IN_HOURS = int(os.environ.get("JWT_EXPIRES_IN_HOURS", 168))  # 7 jours

    CORS_ORIGINS = [
        o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:5173").split(",")
    ]

    DB_PATH = BASE_DIR / "data" / "db.json"
