"""Configuration centralisée de l'Itinerary Service."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SERVICE_NAME = "itinerary-service"
    PORT = int(os.environ.get("PORT", 5002))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    COOKIE_NAME = "mboatrip_token"
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",")]

    # DESTINATIONS_PATH n'est plus la source de vérité en continu : elle ne sert
    # plus qu'une fois, pour "amorcer" PostgreSQL au tout premier démarrage
    # (si la table destinations est vide). Ensuite, tout passe par la base.
    DESTINATIONS_PATH = BASE_DIR / "data" / "destinations.json"

    RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_only_internal_key")
    USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://user-service:5001")
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://mboatrip:change_this_password@localhost:5432/mboatrip")

    # Frais de réservation via MTN Mobile Money (Collections API). Non
    # remboursables, distincts du paiement du séjour (réglé sur place, à
    # l'hôtel) — voir momo_client.py. Vide en local/dev tant que le compte
    # MTN MoMo Developer n'a pas fourni de vraies clés.
    MOMO_BASE_URL = os.environ.get("MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com")
    MOMO_SUBSCRIPTION_KEY = os.environ.get("MOMO_SUBSCRIPTION_KEY", "")
    MOMO_API_USER = os.environ.get("MOMO_API_USER", "")
    MOMO_API_KEY = os.environ.get("MOMO_API_KEY", "")
    MOMO_TARGET_ENVIRONMENT = os.environ.get("MOMO_TARGET_ENVIRONMENT", "sandbox")
    # Le sandbox MTN MoMo n'accepte QUE la devise EUR pour les tests — la
    # vraie devise (XAF/FCFA) ne sera disponible qu'en production, une fois
    # l'accord marchand signé avec MTN.
    MOMO_CURRENCY = os.environ.get("MOMO_CURRENCY", "EUR")
    BOOKING_FEE_FCFA = int(os.environ.get("BOOKING_FEE_FCFA", 1000))
