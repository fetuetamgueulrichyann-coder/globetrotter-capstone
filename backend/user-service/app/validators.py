"""Validation manuelle des payloads entrants."""
import io
import os
import re
import uuid

from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

from app.config import Config

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Fournisseurs d'emails jetables/temporaires les plus courants — bloqués à
# l'inscription pour éviter les faux comptes. Liste non exhaustive mais
# couvre l'immense majorité des services de "mail temporaire" utilisés pour
# contourner une inscription.
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
    "10minutemail.net", "tempmail.com", "temp-mail.org", "throwawaymail.com",
    "yopmail.com", "yopmail.fr", "trashmail.com", "sharklasers.com", "fakeinbox.com",
    "dispostable.com", "maildrop.cc", "getnada.com", "mohmal.com", "mintemail.com",
    "moakt.com", "emailondeck.com", "mailnesia.com", "spamgourmet.com", "tempinbox.com",
    "fake-mail.net", "byom.de", "discard.email", "mailcatch.com", "getairmail.com",
    "burnermail.io", "harakirimail.com", "spam4.me", "mytemp.email", "tempr.email",
}


def is_disposable_email(email):
    domain = email.strip().lower().rsplit("@", 1)[-1]
    return domain in DISPOSABLE_EMAIL_DOMAINS


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
    elif is_disposable_email(email):
        errors.append({"field": "email", "message": "Les adresses email jetables/temporaires ne sont pas acceptées"})
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


def validate_profile_update(data):
    errors = []
    if "name" in data:
        name = data["name"]
        if not isinstance(name, str) or not (2 <= len(name.strip()) <= 100):
            errors.append({"field": "name", "message": "Le nom doit contenir entre 2 et 100 caractères"})
    if "bio" in data:
        bio = data["bio"]
        if not isinstance(bio, str) or len(bio) > 280:
            errors.append({"field": "bio", "message": "La bio ne peut pas dépasser 280 caractères"})
    if "avatarUrl" in data:
        avatar = data["avatarUrl"]
        if not isinstance(avatar, str) or len(avatar) > 2000:
            errors.append({"field": "avatarUrl", "message": "URL d'avatar invalide"})
    if "city" in data:
        city = data["city"]
        if not isinstance(city, str) or len(city) > 100:
            errors.append({"field": "city", "message": "Ville invalide"})
    if "country" in data:
        country = data["country"]
        if not isinstance(country, str) or len(country) > 100:
            errors.append({"field": "country", "message": "Pays invalide"})
    if "messagingPrivacy" in data and data["messagingPrivacy"] not in ("everyone", "nobody"):
        errors.append({"field": "messagingPrivacy", "message": "Valeur invalide"})
    if "notificationsEnabled" in data and not isinstance(data["notificationsEnabled"], bool):
        errors.append({"field": "notificationsEnabled", "message": "Valeur invalide"})
    if "themePreference" in data and data["themePreference"] not in ("light", "dark"):
        errors.append({"field": "themePreference", "message": "Valeur invalide"})
    return errors


class ImageRejected(Exception):
    def __init__(self, message):
        self.message = message


def _extension(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def save_avatar_image(file):
    """
    Valide puis enregistre la photo de profil uploadée (FileStorage Flask).
    Même politique de sécurité que les photos de publications du Social
    Service : extension whitelist, taille max, contenu réellement décodé
    comme une image (Pillow, pas juste l'extension), nom de fichier généré
    côté serveur (jamais celui fourni par le client).
    Retourne le chemin public (/avatars/xxx.jpg) de l'image sauvegardée.
    """
    original_name = secure_filename(file.filename or "")
    ext = _extension(original_name)
    if ext not in Config.ALLOWED_IMAGE_EXTENSIONS:
        raise ImageRejected(f"Format non supporté : {original_name or 'fichier'} (jpg, png, webp uniquement)")

    raw = file.read()
    if len(raw) > Config.MAX_AVATAR_SIZE_BYTES:
        raise ImageRejected("L'image dépasse la taille maximale de 4 Mo")
    if len(raw) == 0:
        raise ImageRejected("Le fichier est vide")

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
    except (UnidentifiedImageError, OSError):
        raise ImageRejected("Le fichier n'est pas une image valide")

    Config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    dest_path = Config.UPLOADS_DIR / safe_name
    with open(dest_path, "wb") as out:
        out.write(raw)

    return f"/users/avatars/{safe_name}"


def delete_avatar_file(avatar_url):
    """Supprime l'ancien fichier avatar (best-effort) — ignore les URL externes (http...)."""
    if not avatar_url or avatar_url.startswith("http"):
        return
    filename = os.path.basename(avatar_url)
    path = Config.UPLOADS_DIR / filename
    try:
        if path.exists() and path.is_relative_to(Config.UPLOADS_DIR):
            path.unlink()
    except Exception:
        pass
