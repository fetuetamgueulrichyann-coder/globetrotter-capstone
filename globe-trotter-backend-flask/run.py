"""Point d'entrée du serveur Flask (aussi utilisé par Gunicorn : run:app)."""
from app import create_app
from app.config import Config

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
