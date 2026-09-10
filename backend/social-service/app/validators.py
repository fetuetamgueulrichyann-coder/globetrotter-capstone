"""Validation des publications + sauvegarde sécurisée des photos uploadées."""
import io
import os
import uuid

from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

from app.config import Config


def validate_post_fields(city, caption, visit_date):
    errors = []

    if city not in Config.ALLOWED_CITIES:
        errors.append({
            "field": "city",
            "message": f"La ville doit être l'une de : {', '.join(Config.ALLOWED_CITIES)}",
        })

    if not isinstance(caption, str) or not (1 <= len(caption.strip()) <= 500):
        errors.append({"field": "caption", "message": "La légende doit contenir entre 1 et 500 caractères"})

    if visit_date:
        # Format attendu : YYYY-MM-DD (input type="date" côté frontend)
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", visit_date):
            errors.append({"field": "visitDate", "message": "Date de visite invalide (format attendu : AAAA-MM-JJ)"})

    return errors


def validate_comment_content(content):
    if not isinstance(content, str) or not (1 <= len(content.strip()) <= 500):
        return [{"field": "content", "message": "Le commentaire doit contenir entre 1 et 500 caractères"}]
    return []


class ImageRejected(Exception):
    def __init__(self, message):
        self.message = message


def _extension(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def save_uploaded_images(files):
    """
    Valide puis enregistre une liste de fichiers uploadés (FileStorage Flask).
    Sécurité appliquée :
    - extension whitelist (jpg/jpeg/png/webp)
    - taille max par fichier
    - nombre max d'images par publication
    - le contenu est réellement décodé comme une image (Pillow) : un fichier
      exécutable renommé en .jpg est rejeté, il ne suffit pas de regarder
      l'extension ou le nom déclaré
    - nom de fichier généré côté serveur (uuid), jamais le nom fourni par le
      client : élimine tout risque de traversée de répertoire ou de collision
    Retourne la liste des chemins publics (/uploads/xxx.jpg) des images sauvegardées.
    """
    if len(files) > Config.MAX_IMAGES_PER_POST:
        raise ImageRejected(f"Maximum {Config.MAX_IMAGES_PER_POST} photos par publication")

    Config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    saved_paths = []

    for file in files:
        original_name = secure_filename(file.filename or "")
        ext = _extension(original_name)
        if ext not in Config.ALLOWED_IMAGE_EXTENSIONS:
            raise ImageRejected(f"Format non supporté : {original_name or 'fichier'} (jpg, png, webp uniquement)")

        raw = file.read()
        if len(raw) > Config.MAX_IMAGE_SIZE_BYTES:
            raise ImageRejected(f"{original_name} dépasse la taille maximale de 5 Mo")
        if len(raw) == 0:
            raise ImageRejected(f"{original_name} est vide")

        # Vérifie que le contenu est VRAIMENT une image décodable, pas juste
        # un fichier avec une extension trompeuse.
        try:
            img = Image.open(io.BytesIO(raw))
            img.verify()
        except (UnidentifiedImageError, OSError):
            raise ImageRejected(f"{original_name} n'est pas une image valide")

        safe_name = f"{uuid.uuid4().hex}.{ext}"
        dest_path = Config.UPLOADS_DIR / safe_name
        with open(dest_path, "wb") as out:
            out.write(raw)

        saved_paths.append(f"/uploads/{safe_name}")

    return saved_paths


def delete_image_files(image_urls):
    """Supprime les fichiers physiques associés à un post effacé (best-effort)."""
    for url in image_urls:
        filename = os.path.basename(url)
        path = Config.UPLOADS_DIR / filename
        try:
            if path.exists() and path.is_relative_to(Config.UPLOADS_DIR):
                path.unlink()
        except Exception:
            pass  # nettoyage best-effort : ne doit jamais faire échouer la requête
