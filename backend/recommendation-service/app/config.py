import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SERVICE_NAME = "recommendation-service"
    PORT = int(os.environ.get("PORT", 5003))
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    JWT_SECRET = os.environ.get("JWT_SECRET", "dev_only_insecure_secret_change_me")
    COOKIE_NAME = "mboatrip_token"
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",")]

    RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev_only_internal_key")

    USER_SERVICE_URL = os.environ.get("USER_SERVICE_URL", "http://user-service:5001")
    ITINERARY_SERVICE_URL = os.environ.get("ITINERARY_SERVICE_URL", "http://itinerary-service:5002")
