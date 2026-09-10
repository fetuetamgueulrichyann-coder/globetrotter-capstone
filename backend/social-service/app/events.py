"""
Publication d'événements asynchrones vers RabbitMQ, sur le même exchange
que les autres services ("globetrotter.events") — permettra au futur
service de notifications (Phase 7) de s'abonner sans coupler Social Service
à son existence.
"""
import json
import pika
from app.config import Config
from app import logger

EXCHANGE = "globetrotter.events"


def _get_connection():
    params = pika.URLParameters(Config.RABBITMQ_URL)
    return pika.BlockingConnection(params)


def publish_event(routing_key, payload):
    """Échec non bloquant : si RabbitMQ est down, on logue mais on ne casse
    pas la requête HTTP en cours."""
    try:
        connection = _get_connection()
        channel = connection.channel()
        channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload, ensure_ascii=False),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
        )
        connection.close()
        logger.info("Événement publié", routingKey=routing_key)
    except Exception as e:
        logger.error("Échec de publication d'événement (non bloquant)", routingKey=routing_key, error=str(e))
