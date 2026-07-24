"""Application factory Flask : sécurité, blueprints, gestion des erreurs."""
from datetime import datetime, timezone

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.config import Config
from app import logger  # noqa: F401  (rend `from app import logger` valide ailleurs)

limiter = Limiter(key_func=get_remote_address, default_limits=["300 per 15 minutes"])


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # --- CORS restreint aux origines autorisées ---
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    # --- Rate limiting (anti brute-force / anti-DoS basique) ---
    limiter.init_app(app)

    # --- Headers de sécurité HTTP (équivalent Helmet côté Node) ---
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    # --- Health check ---
    @app.get("/api/health")
    def health():
        return jsonify({
            "success": True, "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }), 200

    # --- Import différé des blueprints (évite les imports circulaires) ---
    from app.auth import auth_bp
    from app.destinations import destinations_bp
    from app.recommendations import recommendations_bp
    from app.itineraries import itineraries_bp
    from app.errors import register_error_handlers

    app.register_blueprint(auth_bp)
    app.register_blueprint(destinations_bp)
    app.register_blueprint(recommendations_bp)
    app.register_blueprint(itineraries_bp)

    # Rate limit strict sur les routes d'authentification (brute-force)
    limiter.limit("20 per 15 minutes")(auth_bp)

    register_error_handlers(app)

    logger.info("Globe Trotter API (Flask) initialisée", env=Config.ENV)
    return app
