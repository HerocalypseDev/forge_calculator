"""Text parsers for trait / rune / achievement / ore-power strings.

These mirror the exact substring-matching behavior of the workbook formulas
(A27-A31, E44-E47, E6-E9):

* ``SEARCH("Lethality", cell)`` -> match the literal substring (case-insensitive).
* ``VALUE(MID(cell, FIND("+")+1, LEN(cell)-FIND("+")-1))/100`` -> take
  everything after the first ``+``, drop exactly ONE trailing character (the
  ``%``), parse as a number, divide by 100.

The two vocabularies are preserved:
* rune slots parse ``Lethality`` / ``Crit Chance`` / ``Crit DMG`` / ``Atk Speed``
  (formulas A27-A31);
* the achievement selector parses ``Damage Boost`` / ``Crit Chance`` /
  ``Attack Speed`` (formulas E44/E45/E47).  ``Damage Boost`` feeds Lethality.
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
    """Extract the number after the first ``+``, dropping one trailing char.

    Mirrors ``VALUE(MID(cell, FIND("+")+1, LEN(cell)-FIND("+")-1))``.
    Returns the raw number (pre-``/100``) or ``None``.
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
    """Parse a trait string like ``"Crit Chance +14%"``.

    Returns ``(stat, decimal_value)`` e.g. ``("crit_chance", 0.14)``, or
    ``None`` when the text contains no recognized stat (e.g. ``"None"``).
    """
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
    """Parse an ore multiplier string like ``"2.33x"`` -> ``2.33``.

    Mirrors ``IFERROR(VALUE(SUBSTITUTE(VLOOKUP(...), "x", "")), 1)``:
    strips the ``x`` and converts to float; falls back to 1.0 on error.
    """
    if text is None:
        return 1.0
    cleaned = str(text).strip().lower().replace("x", "")
    try:
        return float(cleaned)
    except ValueError:
        return 1.0
