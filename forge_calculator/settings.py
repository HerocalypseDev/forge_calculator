"""Persistent app state: a small JSON file under the user's home directory.

Pure stdlib, no tkinter.  The config dir is ``~/.forge_calculator`` unless the
``FORGE_CALCULATOR_CONFIG`` env var points somewhere else (the tests use it so
they never touch the real user config).  ``load_state`` is deliberately
tolerant -- a missing or corrupt file is just an empty state, never a crash.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

__all__ = ["config_dir", "state_path", "load_state", "save_state"]


def config_dir() -> Path:
    override = os.environ.get("FORGE_CALCULATOR_CONFIG")
    if override:
        return Path(override)
    return Path.home() / ".forge_calculator"


def state_path() -> Path:
    return config_dir() / "state.json"


def load_state() -> dict:
    path = state_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def save_state(state: dict) -> None:
    path = state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        return
    # write to a temp file then replace, so a crash mid-write can't leave a
    # half-written state.json behind
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2)
        os.replace(tmp, path)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
