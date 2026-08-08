"""Substring parsers for trait / rune / achievement / ore-power strings.

Mirrors the workbook formulas (A27-A31, E44-E47, E6-E9): case-insensitive
substring match, then everything after the first ``+`` with one trailing
character dropped and divided by 100.  Rune slots match Lethality / Crit
Chance / Crit DMG / Atk Speed; the achievement selector matches Damage Boost /
Crit Chance / Attack Speed, where Damage Boost feeds lethality.
"""

from __future__ import annotations

import re

__all__ = ["parse_trait", "parse_ore_power", "STAT_KEYS"]


# stat -> (substring keys).  Order matters: the achievement vocabulary
# ("Damage Boost", "Attack Speed") is checked before the rune vocabulary.
_STAT_PATTERNS = [
    ("lethality", ("Damage Boost", "Lethality")),
    ("crit_chance", ("Crit Chance",)),
    ("crit_dmg", ("Crit DMG",)),
    ("atk_speed", ("Attack Speed", "Atk Speed")),
]

STAT_KEYS = [k for k, _ in _STAT_PATTERNS]


def _extract_value(text: str):
    """Number after the first ``+``, minus one trailing char (the ``%``).

    Mirrors ``VALUE(MID(cell, FIND("+")+1, LEN(cell)-FIND("+")-1))`` and
    returns the raw number (pre-``/100``), or ``None``.
    """
    idx = text.find("+")
    if idx < 0:
        return None
    rest = text[idx + 1:]
    if not rest:
        return None
    rest = rest[:-1].strip()  # drop exactly one trailing character (the %)
    try:
        return float(rest)
    except ValueError:
        return None


def parse_trait(text: str):
    """``"Crit Chance +14%"`` -> ``("crit_chance", 0.14)``, else ``None``."""
    if not text:
        return None
    stripped = text.strip()
    if not stripped or stripped.lower() == "none":
        return None
    raw = _extract_value(stripped)
    if raw is None:
        return None
    low = stripped.lower()
    for stat, keys in _STAT_PATTERNS:
        if any(key.lower() in low for key in keys):
            return (stat, raw / 100.0)
    return None


def parse_ore_power(text):
    """``"2.33x"`` -> ``2.33`` (``IFERROR(VALUE(SUBSTITUTE(...,"x","")), 1)``)."""
    if text is None:
        return 1.0
    cleaned = str(text).strip().lower().replace("x", "")
    try:
        return float(cleaned)
    except ValueError:
        return 1.0
