"""Commentaires + votes utile/pas utile — PostgreSQL (SQLAlchemy). Mêmes signatures qu'avant (comments.json)."""
from sqlalchemy import func
from app.db import get_session
from app.db_models import CommentRow, CommentVoteRow, CommentReportRow


def _comment_to_dict(row):
    if not row:
        return None
    return {
        "id": row.id, "postId": row.post_id, "userId": row.user_id,
        "content": row.content, "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def create_comment(post_id, user_id, content):
    with get_session() as s:
        row = CommentRow(post_id=post_id, user_id=user_id, content=content)
        s.add(row)
        s.flush()
        return _comment_to_dict(row)


def list_comments_for_post(post_id):
    with get_session() as s:
        rows = s.query(CommentRow).filter(CommentRow.post_id == post_id).order_by(CommentRow.created_at.asc()).all()
        return [_comment_to_dict(r) for r in rows]


def find_comment(comment_id):
    with get_session() as s:
        row = s.get(CommentRow, comment_id)
        return _comment_to_dict(row)


def delete_comment(comment_id, user_id, is_admin=False):
    with get_session() as s:
        row = s.get(CommentRow, comment_id)
        if not row:
            return None
        if row.user_id != user_id and not is_admin:
            return "forbidden"
        data = _comment_to_dict(row)
        s.query(CommentReportRow).filter(CommentReportRow.comment_id == comment_id).delete()
        s.delete(row)
        return data


def list_all_comments(limit=200):
    """
    Modération admin : tous les commentaires, triés en priorité par nombre
    de signalements (les plus signalés en premier), puis par date récente.
    """
    with get_session() as s:
        rows = s.query(CommentRow).order_by(CommentRow.created_at.desc()).limit(limit).all()
        report_counts = dict(
            s.query(CommentReportRow.comment_id, func.count(CommentReportRow.id))
            .group_by(CommentReportRow.comment_id).all()
        )
        items = [{**_comment_to_dict(r), "reportCount": report_counts.get(r.id, 0)} for r in rows]
        items.sort(key=lambda c: c["reportCount"], reverse=True)
        return items


def count_comments_for_post(post_id):
    with get_session() as s:
        return s.query(CommentRow).filter(CommentRow.post_id == post_id).count()


def count_all_comments():
    with get_session() as s:
        return s.query(CommentRow).count()


def delete_comments_for_post(post_id):
    with get_session() as s:
        s.query(CommentRow).filter(CommentRow.post_id == post_id).delete()


# ------------------------------------------------------------------ Votes

def cast_vote(comment_id, user_id, value):
    with get_session() as s:
        existing = s.query(CommentVoteRow).filter(
            CommentVoteRow.comment_id == comment_id, CommentVoteRow.user_id == user_id
        ).first()
        if existing:
            existing.value = value
            return {"id": existing.id, "commentId": comment_id, "userId": user_id, "value": value}
        row = CommentVoteRow(comment_id=comment_id, user_id=user_id, value=value)
        s.add(row)
        s.flush()
        return {"id": row.id, "commentId": comment_id, "userId": user_id, "value": value}


def remove_vote(comment_id, user_id):
    with get_session() as s:
        deleted = s.query(CommentVoteRow).filter(
            CommentVoteRow.comment_id == comment_id, CommentVoteRow.user_id == user_id
        ).delete()
        return deleted > 0


def get_user_vote(comment_id, user_id):
    with get_session() as s:
        row = s.query(CommentVoteRow).filter(
            CommentVoteRow.comment_id == comment_id, CommentVoteRow.user_id == user_id
        ).first()
        return row.value if row else None


def list_votes_for_comment(comment_id):
    with get_session() as s:
        rows = s.query(CommentVoteRow).filter(CommentVoteRow.comment_id == comment_id).all()
        helpful = [r.user_id for r in rows if r.value == "helpful"]
        unhelpful = [r.user_id for r in rows if r.value == "unhelpful"]
        return helpful, unhelpful


def delete_votes_for_comment(comment_id):
    with get_session() as s:
        s.query(CommentVoteRow).filter(CommentVoteRow.comment_id == comment_id).delete()


# ----------------------------------------------------------------- Signalements

def report_comment(comment_id, reporter_id, reason=""):
    """Idempotent : un second signalement du même utilisateur ne compte pas deux fois."""
    with get_session() as s:
        existing = s.query(CommentReportRow).filter_by(comment_id=comment_id, reporter_id=reporter_id).first()
        if existing:
            return {"alreadyReported": True}
        s.add(CommentReportRow(comment_id=comment_id, reporter_id=reporter_id, reason=reason))
        return {"alreadyReported": False}
