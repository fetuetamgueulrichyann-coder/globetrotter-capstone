"""
Connexion PostgreSQL (SQLAlchemy) du User Service.

Chaque microservice garde sa propre couche de données indépendante (aucun
autre service ne touche directement ces tables) — seul le *type* de stockage
change (PostgreSQL au lieu d'un fichier JSON), la séparation par service
microservice reste intacte.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager

from app.config import Config

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


def init_db():
    """
    Crée les tables manquantes au démarrage de l'application. Important :
    create_all() ne crée QUE les tables absentes — sur une table déjà
    existante (comme "users" en prod), il n'ajoute JAMAIS une colonne
    nouvellement ajoutée au modèle Python. C'est pour ça que
    _run_column_migrations() ci-dessous existe : sans elle, une nouvelle
    colonne (ex. facebook_id) fonctionnerait en local sur une base neuve
    mais casserait silencieusement en prod sur la base déjà peuplée.
    """
    from app import db_models  # noqa: F401 — enregistre les modèles sur Base avant create_all
    Base.metadata.create_all(bind=engine)
    _run_column_migrations()
    _seed_admin_if_missing()


def _run_column_migrations():
    """
    Migrations idempotentes et additives uniquement (ADD COLUMN IF NOT
    EXISTS) — jamais de DROP ni de modification destructrice. Chaque ligne
    peut être rejouée sans risque à chaque démarrage.
    """
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR",
        "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_facebook_id ON users (facebook_id) WHERE facebook_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id) WHERE google_id IS NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS messaging_privacy VARCHAR NOT NULL DEFAULT 'everyone'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR NOT NULL DEFAULT 'light'",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def _seed_admin_if_missing():
    """
    Crée le compte administrateur au tout premier démarrage, s'il n'existe
    pas déjà (idempotent — ne s'exécute qu'une fois en pratique, sans jamais
    écraser le mot de passe si l'admin l'a changé depuis). Identifiants :
    nom "admin", mot de passe défini via la variable d'environnement
    ADMIN_SEED_PASSWORD (jamais stocké en clair — haché comme tout autre
    compte).
    """
    from app.db_models import UserRow
    from werkzeug.security import generate_password_hash
    from app.config import Config

    with get_session() as s:
        existing = s.query(UserRow).filter_by(role="admin").first()
        if existing:
            # Migration douce : si l'admin a encore l'ancien email
            # générique de démarrage, on le fait basculer vers le nouvel
            # email de connexion — sans jamais toucher au mot de passe déjà
            # en place si l'admin l'a changé.
            if existing.email == "admin@mboatrip.internal" and Config.ADMIN_EMAIL != existing.email:
                existing.email = Config.ADMIN_EMAIL
            return
        admin = UserRow(
            name="admin",
            email=Config.ADMIN_EMAIL,
            password_hash=generate_password_hash(Config.ADMIN_SEED_PASSWORD),
            role="admin",
        )
        s.add(admin)
