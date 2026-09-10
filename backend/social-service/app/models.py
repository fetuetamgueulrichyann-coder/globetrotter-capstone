"""Couche de données des publications — PostgreSQL (SQLAlchemy). Mêmes signatures qu'avant (posts.json)."""
from app.db import get_session
from app.db_models import PostRow


def _to_dict(row):
    if not row:
        return None
    return {
        "id": row.id, "userId": row.user_id, "city": row.city,
        "locationName": row.location_name or "", "caption": row.caption,
        "visitDate": row.visit_date, "images": row.images or [],
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def create_post(user_id, city, location_name, caption, visit_date, image_urls):
    with get_session() as s:
        row = PostRow(
            user_id=user_id, city=city, location_name=location_name,
            caption=caption, visit_date=visit_date, images=image_urls,
        )
        s.add(row)
        s.flush()
        return _to_dict(row)


def find_by_id(post_id):
    with get_session() as s:
        row = s.get(PostRow, post_id)
        return _to_dict(row)


def count_posts():
    with get_session() as s:
        return s.query(PostRow).count()


def list_posts(user_id=None, city=None, limit=20, offset=0):
    with get_session() as s:
        q = s.query(PostRow)
        if user_id:
            q = q.filter(PostRow.user_id == user_id)
        if city:
            q = q.filter(PostRow.city == city)
        total = q.count()
        rows = q.order_by(PostRow.created_at.desc()).offset(offset).limit(limit).all()
        return [_to_dict(r) for r in rows], total


def delete_post(post_id, user_id):
    with get_session() as s:
        row = s.get(PostRow, post_id)
        if not row:
            return None
        if row.user_id != user_id:
            return "forbidden"
        data = _to_dict(row)
        s.delete(row)
        return data
