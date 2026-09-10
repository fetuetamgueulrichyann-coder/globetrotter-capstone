"""Favoris — PostgreSQL (SQLAlchemy). Mêmes signatures qu'avant (favorites.json)."""
from app.db import get_session
from app.db_models import FavoriteRow


def add_favorite(user_id, post_id, city, location_name):
    with get_session() as s:
        exists = s.query(FavoriteRow).filter(
            FavoriteRow.user_id == user_id, FavoriteRow.post_id == post_id
        ).first()
        if exists:
            return None
        row = FavoriteRow(user_id=user_id, post_id=post_id, city=city, location_name=location_name)
        s.add(row)
        s.flush()
        return {"id": row.id, "userId": user_id, "postId": post_id}


def remove_favorite(user_id, post_id):
    with get_session() as s:
        deleted = s.query(FavoriteRow).filter(
            FavoriteRow.user_id == user_id, FavoriteRow.post_id == post_id
        ).delete()
        return deleted > 0


def is_favorited(user_id, post_id):
    with get_session() as s:
        return s.query(FavoriteRow).filter(
            FavoriteRow.user_id == user_id, FavoriteRow.post_id == post_id
        ).first() is not None


def list_favorite_post_ids(user_id):
    with get_session() as s:
        rows = s.query(FavoriteRow).filter(FavoriteRow.user_id == user_id) \
            .order_by(FavoriteRow.created_at.desc()).all()
        return [r.post_id for r in rows]


def delete_favorites_for_post(post_id):
    with get_session() as s:
        s.query(FavoriteRow).filter(FavoriteRow.post_id == post_id).delete()
