FROM python:3.12-slim

# Empêche Python de bufferiser les logs (utile pour "docker logs" en temps réel)
ENV PYTHONUNBUFFERED=1
ENV PORT=4000

WORKDIR /app

# Installer les dépendances d'abord (profite du cache Docker si seul le code change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste du code
COPY . .

EXPOSE 4000

# Gunicorn = serveur WSGI de production (le serveur dev Flask n'est pas fait pour ça)
CMD ["gunicorn", "--bind", "0.0.0.0:4000", "--workers", "2", "--access-logfile", "-", "run:app"]
