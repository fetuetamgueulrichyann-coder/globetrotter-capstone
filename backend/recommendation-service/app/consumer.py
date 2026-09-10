"""
Consommateur RabbitMQ tournant dans un thread d'arrière-plan.
S'abonne aux événements "user.registered" et "itinerary.created"
pour invalider le cache de recommandations de l'utilisateur concerné.
C'est le pendant "asynchrone" du Recommendation Service, exigé par
la Phase 2 (communication async via file de messages).
"""
import json
import threading
import time
import pika

from app.config import Config
from app import logger, cache

EXCHANGE = "globetrotter.events"
QUEUE = "recommendation-service.cache-invalidation"
ROUTING_KEYS = ["user.registered", "itinerary.created"]


def _handle_message(ch, method, properties, body):
    try:
        payload = json.loads(body)
        user_id = payload.get("userId")
        if user_id:
            cache.invalidate(user_id)
            logger.info("Cache invalidé suite à un événement", userId=user_id, routingKey=method.routing_key)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error("Erreur de traitement d'événement", error=str(e))
        ch.basic_ack(delivery_tag=method.delivery_tag)  # évite de bloquer la queue en boucle


def _consume_loop():
    while True:
        try:
            params = pika.URLParameters(Config.RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
            channel.queue_declare(queue=QUEUE, durable=True)
            for key in ROUTING_KEYS:
                channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key=key)

            channel.basic_consume(queue=QUEUE, on_message_callback=_handle_message)
            logger.info("Consumer RabbitMQ démarré", queue=QUEUE, routingKeys=ROUTING_KEYS)
            channel.start_consuming()
        except Exception as e:
            logger.error("Consumer RabbitMQ déconnecté, nouvelle tentative dans 5s", error=str(e))
            time.sleep(5)


def start_consumer_thread():
    thread = threading.Thread(target=_consume_loop, daemon=True)
    thread.start()
    return thread
