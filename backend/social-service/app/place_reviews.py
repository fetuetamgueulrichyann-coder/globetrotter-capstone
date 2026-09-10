"""Couche de données des avis/notes sur les lieux (site, hôtel, restaurant, spa...)."""
from app.db import get_session
from app.db_models import PlaceReviewRow


def _to_dict(row):
    return {
        "id": row.id,
        "placeId": row.place_id,
        "placeName": row.place_name,
        "userId": row.user_id,
        "stars": row.stars,
        "comment": row.comment,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def list_reviews_for_place(place_id, limit=100):
    with get_session() as s:
        rows = (
            s.query(PlaceReviewRow)
            .filter_by(place_id=place_id)
            .order_by(PlaceReviewRow.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_to_dict(r) for r in rows]


def get_place_summary(place_id):
    with get_session() as s:
        rows = s.query(PlaceReviewRow).filter_by(place_id=place_id).all()
        count = len(rows)
        average = round(sum(r.stars for r in rows) / count, 1) if count else 0
        return {"placeId": place_id, "averageStars": average, "reviewCount": count}


def upsert_review(place_id, place_name, user_id, stars, comment):
    """Un avis par utilisateur et par lieu : on remplace si l'utilisateur avait déjà noté ce lieu."""
    with get_session() as s:
        row = s.query(PlaceReviewRow).filter_by(place_id=place_id, user_id=user_id).first()
        if row:
            row.stars = stars
            row.comment = comment
            row.place_name = place_name
        else:
            row = PlaceReviewRow(place_id=place_id, place_name=place_name, user_id=user_id, stars=stars, comment=comment)
            s.add(row)
        s.flush()
        return _to_dict(row)


def delete_review(review_id, user_id, is_admin=False):
    with get_session() as s:
        row = s.get(PlaceReviewRow, review_id)
        if not row:
            return None
        if row.user_id != user_id and not is_admin:
            return "forbidden"
        s.delete(row)
        return True
