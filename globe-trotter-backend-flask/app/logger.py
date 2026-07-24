"""Logger structuré JSON, sans dépendance externe lourde."""
import json
import sys
from datetime import datetime, timezone


def _log(level, message, **meta):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
        **meta,
    }
    stream = sys.stderr if level == "ERROR" else sys.stdout
    print(json.dumps(entry, ensure_ascii=False), file=stream)


def info(message, **meta):
    _log("INFO", message, **meta)


def warn(message, **meta):
    _log("WARN", message, **meta)


def error(message, **meta):
    _log("ERROR", message, **meta)
