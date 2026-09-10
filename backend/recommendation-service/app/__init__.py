from datetime import datetime, timezone
from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config
from app import logger  # noqa: F401


def create_app(start_consumer=True):
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)

    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/health")
    def health():
        return jsonify({"success": True, "service": Config.SERVICE_NAME, "status": "ok",
                         "timestamp": datetime.now(timezone.utc).isoformat()}), 200

    from app.recommendations import recommendations_bp
    from app.errors import register_error_handlers

    app.register_blueprint(recommendations_bp)
    register_error_handlers(app)

    if start_consumer:
        from app.consumer import start_consumer_thread
        start_consumer_thread()

    logger.info(f"{Config.SERVICE_NAME} initialisé", env=Config.ENV)
    return app
