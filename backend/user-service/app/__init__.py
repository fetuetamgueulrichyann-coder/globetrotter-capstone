"""Application factory du User Service."""
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
        logger.info("Base PostgreSQL prête (tables créées si absentes)")
    except Exception as e:
        # On log l'erreur mais on laisse l'app démarrer quand même : le
        # /health remontera le souci clairement plutôt que de planter tout
        # le conteneur en boucle si Postgres met un peu de temps à démarrer.
        logger.error("Impossible de se connecter à PostgreSQL au démarrage", error=str(e))

    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/health")
    def health():
        return jsonify({
            "success": True, "service": Config.SERVICE_NAME, "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }), 200

    from app.auth import auth_bp
    from app.users import users_bp
    from app.errors import register_error_handlers

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    register_error_handlers(app)

    logger.info(f"{Config.SERVICE_NAME} initialisé", env=Config.ENV)
    return app
