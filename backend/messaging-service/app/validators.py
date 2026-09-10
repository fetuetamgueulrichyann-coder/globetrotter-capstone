"""Validation et sauvegarde sécurisée des messages vocaux."""
import uuid
from werkzeug.utils import secure_filename

from app.config import Config

ALLOWED_AUDIO_EXTENSIONS = {"webm", "ogg", "mp4", "m4a", "mp3", "wav"}

# Signatures de fichier (magic bytes) des conteneurs audio les plus courants
# produits par l'enregistreur audio des navigateurs (MediaRecorder).
_SIGNATURES = (
    (b"\x1a\x45\xdf\xa3", 0),   # webm/matroska
    (b"OggS", 0),               # ogg
    (b"RIFF", 0),               # wav
    (b"ID3", 0),                # mp3 (avec tag ID3)
    (b"\xff\xfb", 0),           # mp3 (frame sync, sans tag)
    (b"ftyp", 4),               # mp4/m4a
)


class AudioRejected(Exception):
    def __init__(self, message):
        self.message = message


def _extension(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _looks_like_audio(raw):
    return any(raw[offset:offset + len(sig)] == sig for sig, offset in _SIGNATURES)


def save_voice_message(file):
    """
    Enregistre un message vocal (FileStorage Flask) après validation :
    extension whitelist, taille max, signature de fichier plausible, nom
    généré côté serveur (jamais le nom fourni par le client).
    Retourne le chemin public (/uploads/xxx.webm) du fichier sauvegardé.
    """
    original_name = secure_filename(file.filename or "")
    ext = _extension(original_name) or "webm"
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise AudioRejected(f"Format audio non supporté : {ext}")

    raw = file.read()
    if len(raw) == 0:
        raise AudioRejected("Enregistrement vide")
    if len(raw) > Config.MAX_VOICE_MESSAGE_BYTES:
        raise AudioRejected("Message vocal trop volumineux (2 minutes maximum)")
    if not _looks_like_audio(raw):
        raise AudioRejected("Fichier audio invalide")

    Config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    dest_path = Config.UPLOADS_DIR / safe_name
    with open(dest_path, "wb") as out:
        out.write(raw)

    return f"/conversations/voice-uploads/{safe_name}"
