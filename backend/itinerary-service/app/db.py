"""Connexion PostgreSQL (SQLAlchemy) de l'Itinerary Service."""
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager

from app.config import Config
from app import logger

engine = create_engine(Config.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


@contextmanager
def get_session():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _seed_destinations_if_empty():
    """
    Amorce la table 'destinations' à partir du JSON curaté (Bandjoun,
    Bafoussam, Douala...). N'insère que les destinations dont l'id n'existe
    PAS encore en base — ne touche/n'écrase jamais une destination déjà
    présente (par ex. si elle a été modifiée directement en base). Cela
    permet d'ajouter de nouvelles villes à destinations.json et de les voir
    apparaître au prochain déploiement, même sur une base déjà peuplée.
    """
    from app.db_models import DestinationRow
    with get_session() as s:
        if not Config.DESTINATIONS_PATH.exists():
            logger.warn("destinations.json introuvable, amorçage ignoré (table restera vide)")
            return
        with open(Config.DESTINATIONS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        existing_ids = {row_id for (row_id,) in s.query(DestinationRow.id).all()}
        added = 0
        for dest in raw.get("destinations", []):
            if dest["id"] in existing_ids:
                continue
            s.add(DestinationRow(id=dest["id"], data=dest))
            added += 1
        if added:
            logger.info(f"{added} nouvelle(s) destination(s) importée(s) dans PostgreSQL depuis destinations.json")


def _sync_missing_pois():
    """
    _seed_destinations_if_empty() n'ajoute que des destinations ENTIÈREMENT
    nouvelles — si une destination existe déjà en base (ex. Douala, présente
    depuis longtemps), les points d'intérêt ajoutés après coup dans
    destinations.json n'y apparaissaient jamais. Cette fonction complète :
    pour chaque destination déjà en base, ajoute les POI de destinations.json
    dont le nom n'existe pas encore dans son pointsOfInterest — ne touche
    jamais un POI déjà présent (donc ne réécrase pas une photo déjà modifiée
    depuis l'admin).
    """
    from app.db_models import DestinationRow
    with get_session() as s:
        if not Config.DESTINATIONS_PATH.exists():
            return
        with open(Config.DESTINATIONS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        added_total = 0
        for dest_json in raw.get("destinations", []):
            row = s.get(DestinationRow, dest_json["id"])
            if not row:
                continue  # sera créé par _seed_destinations_if_empty, rien à faire ici
            data = dict(row.data)
            existing_names = {p["name"] for p in data.get("pointsOfInterest", [])}
            new_pois = [p for p in dest_json.get("pointsOfInterest", []) if p["name"] not in existing_names]
            if new_pois:
                data["pointsOfInterest"] = list(data.get("pointsOfInterest", [])) + new_pois
                row.data = data
                added_total += len(new_pois)
        if added_total:
            logger.info(f"{added_total} nouveau(x) point(s) d'intérêt synchronisé(s) depuis destinations.json")


def _sync_poi_extra_fields():
    """
    Comme _sync_missing_pois, mais pour des champs ajoutés après coup à des
    POI déjà existants (priceInfo, phone, address) — les renseigne
    uniquement s'ils sont absents en base, sans jamais écraser une valeur
    déjà modifiée depuis l'admin.
    """
    from app.db_models import DestinationRow
    with get_session() as s:
        if not Config.DESTINATIONS_PATH.exists():
            return
        with open(Config.DESTINATIONS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        updated_total = 0
        for dest_json in raw.get("destinations", []):
            row = s.get(DestinationRow, dest_json["id"])
            if not row:
                continue
            data = dict(row.data)
            json_by_name = {p["name"]: p for p in dest_json.get("pointsOfInterest", [])}
            changed = False
            pois = list(data.get("pointsOfInterest", []))
            for i, poi in enumerate(pois):
                src = json_by_name.get(poi["name"])
                if not src:
                    continue
                poi = dict(poi)
                for field in ("priceInfo", "phone", "address"):
                    if not poi.get(field) and src.get(field):
                        poi[field] = src[field]
                        changed = True
                        updated_total += 1
                pois[i] = poi
            if changed:
                data["pointsOfInterest"] = pois
                row.data = data
        if updated_total:
            logger.info(f"{updated_total} champ(s) budget/contact synchronisé(s) sur des POI existants")


def _run_column_migrations():
    """
    Migrations idempotentes et additives uniquement (ADD COLUMN IF NOT
    EXISTS) — jamais de DROP ni de modification destructrice. Nécessaire
    car create_all() ne modifie jamais une table déjà existante en prod
    (voir le même commentaire dans user-service/app/db.py).
    """
    from sqlalchemy import text
    statements = [
        "ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS fee_amount_fcfa VARCHAR DEFAULT '0'",
        "ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'unpaid'",
        "ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS momo_reference_id VARCHAR",
        "ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS momo_phone VARCHAR DEFAULT ''",
        "ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_booking_momo_ref ON booking_requests (momo_reference_id) WHERE momo_reference_id IS NOT NULL",
        "ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def init_db():
    """Crée les tables manquantes puis amorce les destinations — automatique à chaque déploiement."""
    from app import db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_column_migrations()
    _seed_destinations_if_empty()
    _sync_missing_pois()
    _sync_poi_extra_fields()
