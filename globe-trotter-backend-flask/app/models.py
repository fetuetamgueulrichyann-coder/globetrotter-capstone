"""
Couche de données unique : accès au fichier JSON (data_store) +
opérations métier User / Destination / Itinerary.
Toute lecture/écriture de data/db.json DOIT passer par ici.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone

from app.config import Config
from app import logger

_write_lock = threading.Lock()


# ============ DATA STORE (bas niveau, fichier JSON) ============

def _ensure_db_exists():
    if not Config.DB_PATH.exists():
        Config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        initial = {"users": [], "destinations": [], "itineraries": []}
        with open(Config.DB_PATH, "w", encoding="utf-8") as f:
            json.dump(initial, f, indent=2, ensure_ascii=False)
        logger.warn("db.json absent, fichier initialisé vide", path=str(Config.DB_PATH))


def read_db():
    _ensure_db_exists()
    with open(Config.DB_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            logger.error("Fichier db.json corrompu", error=str(e))
            raise RuntimeError("Base de données corrompue") from e


def _atomic_write(data):
    tmp_path = f"{Config.DB_PATH}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, Config.DB_PATH)  # rename atomique


def transact(mutator):
    """Lit -> applique mutator -> écrit, de façon atomique et thread-safe."""
    with _write_lock:
        db = read_db()
        result = mutator(db)
        _atomic_write(db)
        return result


# ============ USER ============

def find_user_by_email(email):
    db = read_db()
    email = email.lower()
    return next((u for u in db["users"] if u["email"].lower() == email), None)


def find_user_by_id(user_id):
    db = read_db()
    return next((u for u in db["users"] if u["id"] == user_id), None)


def create_user(name, email, password_hash, preferences=None):
    def mutator(db):
        user = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email.lower(),
            "passwordHash": password_hash,
            "preferences": preferences or [],
            "role": "user",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        db["users"].append(user)
        return user

    return transact(mutator)


def sanitize_user(user):
    """Retire les champs sensibles avant d'exposer un user au client."""
    if not user:
        return None
    return {k: v for k, v in user.items() if k != "passwordHash"}


# ============ DESTINATION ============

def find_all_destinations():
    return read_db()["destinations"]


def find_destination_by_id(dest_id):
    return next((d for d in read_db()["destinations"] if d["id"] == dest_id), None)


def search_destinations(search=None, tag=None, sort_by="popularity", order="desc", page=1, limit=10):
    results = list(read_db()["destinations"])

    if search:
        q = search.lower()
        results = [d for d in results if q in d["name"].lower() or q in d["country"].lower()]

    if tag:
        results = [d for d in results if tag.lower() in [t.lower() for t in d["tags"]]]

    allowed_sort = {"popularity", "name", "pricePerDay"}
    sort_field = sort_by if sort_by in allowed_sort else "popularity"
    reverse = order != "asc"
    results.sort(key=lambda d: d[sort_field], reverse=reverse)

    total = len(results)
    page_num = max(1, int(page or 1))
    limit_num = max(1, min(100, int(limit or 10)))
    start = (page_num - 1) * limit_num
    paginated = results[start:start + limit_num]

    return {
        "data": paginated,
        "pagination": {
            "total": total,
            "page": page_num,
            "limit": limit_num,
            "totalPages": max(1, -(-total // limit_num)),  # ceil division
        },
    }


# ============ ITINERARY ============

def find_itineraries_by_user(user_id):
    db = read_db()
    return [
        it for it in db["itineraries"]
        if it["userId"] == user_id or user_id in it.get("sharedWith", [])
    ]


def find_itinerary_by_id(itinerary_id):
    db = read_db()
    return next((it for it in db["itineraries"] if it["id"] == itinerary_id), None)


def create_itinerary(user_id, title, destination_id, start_date, end_date, notes=""):
    def mutator(db):
        itinerary = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "title": title,
            "destinationId": destination_id,
            "startDate": start_date,
            "endDate": end_date,
            "notes": notes or "",
            "sharedWith": [],
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        db["itineraries"].append(itinerary)
        return itinerary

    return transact(mutator)


def share_itinerary_with(itinerary_id, target_user_id):
    def mutator(db):
        itinerary = next((it for it in db["itineraries"] if it["id"] == itinerary_id), None)
        if not itinerary:
            return None
        if target_user_id not in itinerary["sharedWith"]:
            itinerary["sharedWith"].append(target_user_id)
        return itinerary

    return transact(mutator)
