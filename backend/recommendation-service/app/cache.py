"""
Cache en mémoire des recommandations, par utilisateur.
Invalidé de façon ASYNCHRONE : quand l'Itinerary Service publie
"itinerary.created", le consumer RabbitMQ (consumer.py) appelle
invalidate(user_id) pour forcer un recalcul frais au prochain appel.
Ce découplage évite d'appeler les 2 autres services à chaque requête
identique, tout en restant à jour dès qu'un fait pertinent se produit.
"""
import threading

_lock = threading.Lock()
_cache = {}  # user_id -> {"data": [...], "meta": {...}}


def get(user_id):
    with _lock:
        return _cache.get(user_id)


def set(user_id, data, meta):
    with _lock:
        _cache[user_id] = {"data": data, "meta": meta}


def invalidate(user_id):
    with _lock:
        _cache.pop(user_id, None)
