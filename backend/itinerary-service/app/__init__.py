from datetime import datetime, timezone
from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config
from app import logger  # noqa: F401


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    from app.db import init_db
    try:
        init_db()
        logger.info("Base PostgreSQL prête (tables créées + destinations amorcées si besoin)")
    except Exception as e:
        logger.error("Impossible de se connecter à PostgreSQL au démarrage", error=str(e))

    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/health")
    def health():
        return jsonify({"success": True, "service": Config.SERVICE_NAME, "status": "ok",
                         "timestamp": datetime.now(timezone.utc).isoformat()}), 200

    from app.destinations import destinations_bp
    from app.itineraries import itineraries_bp
    from app.errors import register_error_handlers

    app.register_blueprint(destinations_bp)
    app.register_blueprint(itineraries_bp)
    register_error_handlers(app)

    logger.info(f"{Config.SERVICE_NAME} initialisé", env=Config.ENV)
    return app
