"""
Publication d'événements asynchrones vers RabbitMQ.
Le User Service ne connaît PAS ses consommateurs (découplage total) :
il publie un fait ("un utilisateur s'est inscrit") sur un exchange,
et n'importe quel service intéressé peut s'y abonner.
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
    """Publie un événement. Échec non bloquant : si RabbitMQ est down,
    on logue l'erreur mais on ne casse pas la requête HTTP en cours
    (le service reste disponible même si l'event bus est indisponible)."""
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
