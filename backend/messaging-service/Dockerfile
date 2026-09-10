FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5005
# worker-class eventlet : requis pour que Flask-SocketIO gère de vraies
# connexions WebSocket (et pas seulement du long-polling) avec Gunicorn.
# 1 seul worker : eventlet gère la concurrence via des greenlets internes ;
# plusieurs workers eventlet nécessiteraient un message-queue partagé
# (Redis) pour synchroniser les "rooms" entre process, inutile à cette échelle.
CMD ["gunicorn", "--bind", "0.0.0.0:5005", "--worker-class", "eventlet", "--workers", "1", "--access-logfile", "-", "run:app"]
