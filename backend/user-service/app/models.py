"""
Couche de données du User Service — PostgreSQL (SQLAlchemy).

Important : chaque fonction ci-dessous renvoie un dict "au format JSON"
(mêmes clés camelCase qu'avant : passwordHash, avatarUrl, createdAt...),
exactement comme la version précédente basée sur users.json. C'est ce qui
permet à auth.py et users.py de fonctionner SANS AUCUNE MODIFICATION — seul
le stockage en dessous a changé, la structure du projet reste intacte.
"""
from app.db import get_session
from app.db_models import UserRow


def _to_dict(row):
    if not row:
        return None
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "passwordHash": row.password_hash,
        "facebookId": row.facebook_id,
        "googleId": row.google_id,
        "preferences": row.preferences or [],
        "role": row.role,
        "bio": row.bio or "",
        "avatarUrl": row.avatar_url or "",
        "city": row.city or "",
        "country": row.country or "",
        "messagingPrivacy": row.messaging_privacy or "everyone",
        "notificationsEnabled": row.notifications_enabled if row.notifications_enabled is not None else True,
        "themePreference": row.theme_preference or "light",
        "resetTokenHash": row.reset_token_hash,
        "resetTokenExpiresAt": row.reset_token_expires_at.isoformat() if row.reset_token_expires_at else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def find_by_email(email):
    with get_session() as s:
        row = s.query(UserRow).filter(UserRow.email == email.lower()).first()
        return _to_dict(row)


def find_by_facebook_id(facebook_id):
    with get_session() as s:
        row = s.query(UserRow).filter_by(facebook_id=facebook_id).first()
        return _to_dict(row)


def link_facebook_id(user_id, facebook_id):
    """Rattache un id Facebook à un compte existant (retrouvé par email)."""
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if row and not row.facebook_id:
            row.facebook_id = facebook_id
        return _to_dict(row)


def create_from_facebook(name, email, facebook_id):
    with get_session() as s:
        row = UserRow(name=name, email=email.lower(), password_hash=None, facebook_id=facebook_id)
        s.add(row)
        s.flush()
        return _to_dict(row)


def find_by_google_id(google_id):
    with get_session() as s:
        row = s.query(UserRow).filter_by(google_id=google_id).first()
        return _to_dict(row)


def link_google_id(user_id, google_id):
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if row and not row.google_id:
            row.google_id = google_id
        return _to_dict(row)


def create_from_google(name, email, google_id):
    with get_session() as s:
        row = UserRow(name=name, email=email.lower(), password_hash=None, google_id=google_id)
        s.add(row)
        s.flush()
        return _to_dict(row)


def find_by_id(user_id):
    with get_session() as s:
        row = s.get(UserRow, user_id)
        return _to_dict(row)


def find_by_name_and_role(name, role):
    with get_session() as s:
        row = s.query(UserRow).filter_by(name=name, role=role).first()
        return _to_dict(row)


def count_users():
    with get_session() as s:
        return s.query(UserRow).count()


def get_setting(key, default=""):
    from app.db_models import AdminSettingRow
    with get_session() as s:
        row = s.get(AdminSettingRow, key)
        return row.value if row else default


def set_setting(key, value):
    from app.db_models import AdminSettingRow
    with get_session() as s:
        row = s.get(AdminSettingRow, key)
        if row:
            row.value = value
        else:
            s.add(AdminSettingRow(key=key, value=value))


def search_by_name(query, exclude_id=None, limit=15):
    """
    Recherche légère par nom (insensible à la casse, correspondance
    partielle) — utilisée pour permettre à un utilisateur d'en retrouver un
    autre afin de lui écrire (messagerie), sans réintroduire de véritable
    annuaire de profils publics.
    """
    with get_session() as s:
        q = s.query(UserRow).filter(UserRow.name.ilike(f"%{query}%"))
        if exclude_id:
            q = q.filter(UserRow.id != exclude_id)
        rows = q.order_by(UserRow.name.asc()).limit(limit).all()
        return [_to_dict(r) for r in rows]


def create(name, email, password_hash, preferences=None):
    with get_session() as s:
        row = UserRow(
            name=name, email=email.lower(), password_hash=password_hash,
            preferences=preferences or [], role="user",
        )
        s.add(row)
        s.flush()  # récupère l'id/created_at générés avant le commit implicite
        return _to_dict(row)


PROFILE_EDITABLE_FIELDS = ("name", "bio", "avatarUrl", "city", "country", "messagingPrivacy", "notificationsEnabled", "themePreference")
_FIELD_TO_COLUMN = {
    "name": "name", "bio": "bio", "avatarUrl": "avatar_url", "city": "city", "country": "country",
    "messagingPrivacy": "messaging_privacy", "notificationsEnabled": "notifications_enabled", "themePreference": "theme_preference",
}


def update_profile(user_id, fields):
    """Met à jour uniquement les champs de profil autorisés (ignore le reste)."""
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if row:
            for key in PROFILE_EDITABLE_FIELDS:
                if key in fields:
                    setattr(row, _FIELD_TO_COLUMN[key], fields[key])
        return _to_dict(row)


def sanitize(user):
    if not user:
        return None
    return {k: v for k, v in user.items() if k not in ("passwordHash", "resetTokenHash", "resetTokenExpiresAt")}


def set_reset_token(user_id, token_hash, expires_at_iso):
    """Enregistre un token de réinitialisation haché (jamais le token en clair) et sa date d'expiration."""
    from datetime import datetime
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if row:
            row.reset_token_hash = token_hash
            row.reset_token_expires_at = datetime.fromisoformat(expires_at_iso)
        return _to_dict(row)


def find_by_reset_token_hash(token_hash):
    with get_session() as s:
        row = s.query(UserRow).filter(UserRow.reset_token_hash == token_hash).first()
        return _to_dict(row)


def update_password(user_id, new_password_hash):
    """Met à jour le mot de passe et invalide le token de réinitialisation utilisé (usage unique)."""
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if row:
            row.password_hash = new_password_hash
            row.reset_token_hash = None
            row.reset_token_expires_at = None
        return _to_dict(row)


def delete_account(user_id):
    """
    Suppression de compte demandée depuis les Paramètres.

    Anonymise le compte plutôt que de le supprimer physiquement : ses posts,
    avis et messages passés restent visibles pour la cohérence des fils de
    discussion des autres utilisateurs (comme sur la plupart des apps
    sociales), mais ne sont plus rattachés à une identité ni à des
    identifiants de connexion réutilisables. Le compte devient définitivement
    inaccessible : mot de passe et emails de connexion (classique/Google/
    Facebook) sont effacés.
    """
    with get_session() as s:
        row = s.get(UserRow, user_id)
        if not row:
            return False
        row.name = "Utilisateur supprimé"
        row.email = f"compte-supprime-{user_id}@mboatrip.invalid"
        row.password_hash = None
        row.google_id = None
        row.facebook_id = None
        row.bio = ""
        row.avatar_url = ""
        row.reset_token_hash = None
        row.reset_token_expires_at = None
        return True

