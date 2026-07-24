"""Validation manuelle des payloads entrants (léger, sans ORM)."""
import re

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email(value):
    return isinstance(value, str) and bool(EMAIL_RE.match(value))


def validate_register(data):
    errors = []
    name = data.get("name", "")
    email = data.get("email", "")
    password = data.get("password", "")
    preferences = data.get("preferences", [])

    if not isinstance(name, str) or not (2 <= len(name.strip()) <= 100):
        errors.append({"field": "name", "message": "Le nom doit contenir entre 2 et 100 caractères"})
    if not is_valid_email(email):
        errors.append({"field": "email", "message": "Email invalide"})
    if not isinstance(password, str) or len(password) < 8:
        errors.append({"field": "password", "message": "Le mot de passe doit contenir au moins 8 caractères"})
    elif not re.search(r"\d", password):
        errors.append({"field": "password", "message": "Le mot de passe doit contenir au moins un chiffre"})
    if preferences is not None and not isinstance(preferences, list):
        errors.append({"field": "preferences", "message": "Les préférences doivent être un tableau"})
    return errors


def validate_login(data):
    errors = []
    if not is_valid_email(data.get("email", "")):
        errors.append({"field": "email", "message": "Email invalide"})
    if not data.get("password"):
        errors.append({"field": "password", "message": "Le mot de passe est requis"})
    return errors


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


def validate_share(data):
    errors = []
    if not is_valid_email(data.get("email", "")):
        errors.append({"field": "email", "message": "Email invalide"})
    return errors
