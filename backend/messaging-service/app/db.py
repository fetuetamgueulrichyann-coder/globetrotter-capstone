"""Connexion PostgreSQL (SQLAlchemy) du Messaging Service."""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager

from app.config import Config

engine = create_engine(Config.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

GENERAL_GROUP_ID = "general"


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


def init_db():
    from app import db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_column_migrations()
    _seed_general_group_if_missing()


def _run_column_migrations():
    """
    Migrations additives uniquement (ADD COLUMN IF NOT EXISTS / ALTER pour
    autoriser NULL) — rejouables sans risque à chaque démarrage, jamais de
    DROP ni de perte de données existantes.
    """
    statements = [
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'direct'",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title VARCHAR",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for TEXT",
        "ALTER TABLE conversations ALTER COLUMN user_a_id DROP NOT NULL",
        "ALTER TABLE conversations ALTER COLUMN user_b_id DROP NOT NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted VARCHAR NOT NULL DEFAULT 'false'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url VARCHAR",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_seconds VARCHAR",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_id VARCHAR",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS call_kind VARCHAR",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS call_status VARCHAR",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def _seed_general_group_if_missing():
    """Crée le groupe général (visible par tous), une seule fois, de façon idempotente."""
    from app.db_models import ConversationRow

    with get_session() as s:
        existing = s.get(ConversationRow, GENERAL_GROUP_ID)
        if existing:
            return
        s.add(ConversationRow(id=GENERAL_GROUP_ID, type="group", title="Discussion générale"))
