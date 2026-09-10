"""Validation manuelle des payloads."""
import re


def validate_itinerary(data):
    errors = []
    title = data.get("title", "")
    if not isinstance(title, str) or not (2 <= len(title.strip()) <= 150):
        errors.append({"field": "title", "message": "Le titre doit contenir entre 2 et 150 caractères"})
    if not data.get("destinationId"):
        errors.append({"field": "destinationId", "message": "destinationId est requis"})
    for field in ("startDate", "endDate"):
        value = data.get(field, "")
        if not isinstance(value, str) or not re.match(r"^\d{4}-\d{2}-\d{2}", value):
            errors.append({"field": field, "message": f"{field} doit être une date valide (format ISO)"})
    notes = data.get("notes")
    if notes is not None and len(notes) > 2000:
        errors.append({"field": "notes", "message": "Les notes ne peuvent excéder 2000 caractères"})
    return errors


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_share(data):
    errors = []
    email = data.get("email", "")
    if not isinstance(email, str) or not EMAIL_RE.match(email):
        errors.append({"field": "email", "message": "Email invalide"})
    return errors
