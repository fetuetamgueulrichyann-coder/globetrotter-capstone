"""Logger structuré JSON, sans dépendance externe lourde."""
import json
import sys
from datetime import datetime, timezone


def _log(level, msg, **meta):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": msg,
        **meta,
    }
    stream = sys.stderr if level == "ERROR" else sys.stdout
    print(json.dumps(entry, ensure_ascii=False), file=stream)


def info(msg, **meta):
    _log("INFO", msg, **meta)


def warn(msg, **meta):
    _log("WARN", msg, **meta)


def error(msg, **meta):
    _log("ERROR", msg, **meta)
