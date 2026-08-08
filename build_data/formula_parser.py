"""Extracts each ore's ``(base, max, divisor)`` from the workbook formulas.

Those stats live only in the ~17 formula cells C44..C75, every one built from
the same share-scaling expression per slot -- ``IF(share<0.1, 0,
(base+(max-base)*MIN((share-0.1)/0.2, 1))/divisor)`` -- chained with ``IFS``
and combined by SUM/MAX.  This walks the formula strings and pulls the triple
out per ore; nothing is hand-typed, so the matrix is exactly what the formulas
encode.

Source-agnostic: it takes a ``{cell: formula}`` dict, so it can be fed from the
workbook (authoritative) or either ``all_formulas*.txt`` dump (cross-check)
and tested against both.
"""

from __future__ import annotations

import re
from collections import OrderedDict

__all__ = [
    "load_formulas_from_txt",
    "parse_stat_matrix",
    "STAT_CELLS",
]


# cell -> stat name.  This is the ONLY hardcoded table in the build; the values
# themselves are always parsed from the formulas.
STAT_CELLS = {
    "C44": "lethality",
    "C45": "crit_chance",
    "C46": "crit_dmg",
    "C47": "atk_speed",
    "C52": "moon",
    "C57": "explosion_dmg",
    "C58": "explosion_chance",
    "C61": "fire_dmg",
    "C62": "fire_chance",
    "C63": "fire_duration",
    "C66": "poison_dmg",
    "C67": "poison_chance",
    "C68": "poison_duration",
    "C71": "smite_dmg",
    "C72": "smite_chance",
    "C75": "blackhole_dmg",
}
# C76 (black-hole proc chance) is the constant IF(COUNTIF(...)>=0.1,0.3,0) and
# is handled directly in the engine, not in the matrix.


_CELL_HEADER = re.compile(r"^\s*([A-Z]{1,3}[0-9]+):\s*$")


def load_formulas_from_txt(path):
    """Load ``{cell: formula}`` from a formula-dump text file.

    Handles the format of ``all_formulas.txt`` / ``all_formulas_reference (1).txt``:
    a cell header line (``  C58:``), then one or more indented formula lines
    (multi-line formulas are rejoined with a single space), terminated by a
    blank line.  Sheet banners (``SHEET: ...``) are skipped.
    """
    formulas = {}
    current = None
    buf = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = _CELL_HEADER.match(line)
            if m:
                if current and buf:
                    formulas[current] = " ".join(buf)
                current = m.group(1)
                buf = []
                continue
            if current is not None:
                s = line.strip()
                if s == "":
                    if buf:
                        formulas[current] = " ".join(buf)
                    current = None
                    buf = []
                else:
                    buf.append(s)
    if current and buf:
        formulas[current] = " ".join(buf)
    return formulas


# --- tokenizer helpers --------------------------------------------------------

def _normalize(s):
    """Collapse whitespace runs to single spaces (keeps string literals intact)."""
    return re.sub(r"\s+", " ", s).strip()


def _split_top_level(s):
    """Split ``s`` on top-level commas (paren-depth 0), honoring quoted strings."""
    parts = []
    buf = []
    depth = 0
    in_str = False
    i = 0
    while i < len(s):
        c = s[i]
        if in_str:
            buf.append(c)
            if c == '"':
                in_str = False
        elif c == '"':
            in_str = True
            buf.append(c)
        elif c == "(":
            depth += 1
            buf.append(c)
        elif c == ")":
            depth -= 1
            buf.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(c)
        i += 1
    if buf:
        parts.append("".join(buf).strip())
    return parts


def _find_ifs_bodies(s):
    """Return the argument-list bodies of every ``IFS(...)`` call in ``s``."""
    bodies = []
    i = 0
    while True:
        j = s.find("IFS(", i)
        if j < 0:
            break
        k = j + 4
        depth = 0
        in_str = False
        while k < len(s):
            c = s[k]
            if in_str:
                if c == '"':
                    in_str = False
            elif c == '"':
                in_str = True
            elif c == "(":
                depth += 1
            elif c == ")":
                if depth == 0:
                    break
                depth -= 1
            k += 1
        bodies.append(s[j + 4:k])
        i = k + 1
    return bodies


_ORE_IN_COND = re.compile(r'C[0-9]+="([^"]+)"')

# The shared scaling expression:  (base + (max-base)*MIN((Dn/SUM($D$6:$D$9)-0.1)/0.2,1)) [/100]
_SCALE = re.compile(
    r"\(\s*(?P<base>\d+(?:\.\d+)?)\s*\+\s*\(\s*(?P<max>\d+(?:\.\d+)?)"
    r"\s*-\s*(?P=base)\s*\)\s*\*\s*MIN\s*\(\s*\(\s*D[0-9]+\s*/\s*SUM"
    r"\(\$D\$6:\$D\$9\)\s*-\s*0\.1\s*\)\s*/\s*0\.2\s*,\s*1\s*\)\s*\)"
    r"\s*(?P<div>/100)?"
)


def _extract_scale(value):
    """Return ``{base, max, divisor}`` from a scaling expression, or ``None``."""
    m = _SCALE.search(_normalize(value))
    if not m:
        return None
    return {
        "base": float(m.group("base")),
        "max": float(m.group("max")),
        "divisor": 100 if m.group("div") else 1,
    }


def parse_stat_matrix(formulas, stat_cells=None):
    """Derive ``{ore: {stat: {base, max, divisor}}}`` from formula strings.

    ``formulas`` is ``{cell: formula_text}`` (load from the workbook with
    ``data_only=False`` or from the txt dumps).  ``stat_cells`` defaults to
    ``STAT_CELLS``.
    """
    stat_cells = stat_cells or STAT_CELLS
    matrix = OrderedDict()
    for cell, stat in stat_cells.items():
        raw = formulas.get(cell)
        if not raw:
            continue
        s = _normalize(raw)
        for body in _find_ifs_bodies(s):
            args = _split_top_level(body)
            for cond, value in zip(args[0::2], args[1::2]):
                ores = _ORE_IN_COND.findall(cond)
                if not ores:
                    continue  # the TRUE,0 default pair
                entry = _extract_scale(value)
                if entry is None:
                    continue
                for ore in ores:
                    matrix.setdefault(ore, {})[stat] = dict(entry)
    return matrix
