"""Exception métier typée + gestion centralisée des erreurs Flask."""
from flask import jsonify
from app import logger


class ApiError(Exception):
    def __init__(self, status_code, message, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        payload = {"success": False, "error": {"message": err.message}}
        if err.details:
            payload["error"]["details"] = err.details
        if err.status_code >= 500:
            logger.error("Erreur serveur", detail=err.message)
        else:
            logger.warn("Erreur applicative", detail=err.message, statusCode=err.status_code)
        return jsonify(payload), err.status_code

    @app.errorhandler(404)
    def handle_not_found(err):
        return jsonify({"success": False, "error": {"message": "Route non trouvée"}}), 404

    @app.errorhandler(500)
    def handle_server_error(err):
        logger.error("Erreur serveur non gérée", detail=str(err))
        return jsonify({"success": False, "error": {"message": "Erreur interne du serveur"}}), 500
