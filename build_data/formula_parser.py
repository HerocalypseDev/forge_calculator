"""Extracts each ore's ``(base, max, divisor)`` from the workbook formulas.

Those stats live only in the ~18 stat cells of the ``DPS Calculator`` sheet,
every one built from the same share-scaling expression per slot -- ``IF(share<0.1,
0, (base+(max-base)*MIN((share-0.1)/0.2, 1))/divisor)`` -- combined per slot by
``IFS`` / nested ``IF`` / ``OR`` groups and aggregated with SUM/MAX/MIN.  This
walks the formula strings and pulls the triple out per ore; nothing is
hand-typed, so the matrix is exactly what the formulas encode.

The sheet uses four interchangeable spellings of the ramp, all handled here:

* ``(base+(max-base)*MIN(...))/100``  -- most percent stats
* ``(base+delta*MIN(...))/100``      -- C73 smite chance
* ``(base+(max-base)*MIN(...))``     -- C64 fire duration (divisor 1)
* ``base+delta*MIN(...)``            -- E80 lightning cooldown (no parens)

Two per-ore modifiers are also captured when present:

* ``gated`` -- False when the ``IF(share<0.1, 0, ...)`` guard is absent, so the
  ore pays out below the usual 10% share (Kitsunite smite damage).
* ``floor`` / ``ceiling`` -- from a ``MAX(f, MIN(c, ramp))`` clamp (same cell).

Source-agnostic: it takes a ``{cell: formula}`` dict, so it can be fed from the
workbook (authoritative) or a formula dump (cross-check).
"""

from __future__ import annotations

import re
from collections import OrderedDict

__all__ = [
    "load_formulas_from_txt",
    "parse_stat_matrix",
    "STAT_CELLS",
    "LEGACY_STAT_CELLS",
]


# cell -> stat name.  This is the ONLY hardcoded table in the build; the values
# themselves are always parsed from the formulas.  Addresses are reall.xlsx.
STAT_CELLS = {
    "C45": "lethality",
    "C46": "crit_chance",
    "C47": "crit_dmg",
    "C53": "moon",
    "C58": "explosion_dmg",
    "C59": "explosion_chance",
    "C62": "fire_dmg",
    "C63": "fire_chance",
    "C64": "fire_duration",
    "C67": "poison_dmg",
    "C68": "poison_chance",
    "C69": "poison_duration",
    "C72": "smite_dmg",
    "C73": "smite_chance",
    "C76": "blackhole_dmg",
    "C80": "lightning_dmg",
    "E80": "lightning_cooldown",
    "C81": "lightning_chance",
}

# C77 (black-hole proc chance) is the constant IF(COUNTIF(...)>=0.1,0.3,0) and
# is handled directly in the engine, not in the matrix.

# Ore attack speed: the C48 ramp existed in new.xlsx but was replaced by a bare
# input cell in reall.xlsx.  Per the maintainer's call that deletion was a sheet
# regression, so the stat is still sourced -- from the prior workbook, never
# hand-typed.  See reference/new.xlsx.
LEGACY_STAT_CELLS = {
    "C48": "atk_speed",
}


_CELL_HEADER = re.compile(r"^\s*([A-Z]{1,3}[0-9]+):\s*$")


def load_formulas_from_txt(path):
    """Load ``{cell: formula}`` from a formula-dump text file.

    Handles the format of the ``all_formulas*.txt`` dumps: a cell header line
    (``  C58:``), then one or more indented formula lines (multi-line formulas
    are rejoined with a single space), terminated by a blank line.  Sheet
    banners (``SHEET: ...``) are skipped.
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
    return re.sub(r"\s+", " ", str(s)).strip()


# A single slot test, e.g.  C6="Kitsunite"
_ORE_TEST = re.compile(r'C[0-9]+\s*=\s*"([^"]+)"')

# An OR(...) group of slot tests sharing one payload, e.g.
#   OR(C6="Gargantuan",C6="Fireite")
_OR_GROUP = re.compile(r'OR\(\s*(?:C[0-9]+\s*=\s*"[^"]+"\s*,?\s*)+\)')

# The shared ramp.  ``share`` is either ``Dn/SUM($D$6:$D$9)`` (reall.xlsx),
# ``Dn/SUM($D$6:$D$10)`` (new.xlsx had a 5th slot row) or ``row/SUM(...)``
# inside a BYROW/LAMBDA.  Growth is written either as ``(max-base)`` or as a
# bare ``delta``; the trailing ``/100`` marks a percent stat.
_RAMP = re.compile(
    r"(?P<base>-?\d+(?:\.\d+)?)\s*\+\s*"
    r"(?:"
    r"\(\s*(?P<max>-?\d+(?:\.\d+)?)\s*-\s*(?P<base2>-?\d+(?:\.\d+)?)\s*\)"
    r"|"
    r"(?P<delta>-?\d+(?:\.\d+)?)"
    r")"
    r"\s*\*\s*MIN\s*\(\s*\(\s*(?:D[0-9]+|row)\s*/\s*SUM\(\$D\$6:\$D\$(?:9|10)\)"
    r"\s*-\s*0\.1\s*\)\s*/\s*0\.2\s*,\s*1\s*\)"
)

# ``IF(share<0.1, <miss>, ...)`` -- the 10% share gate.  The miss value is 0 for
# every stat except lightning cooldown (E80), which uses 99 as its "no lightning"
# sentinel; either way the ore contributes nothing below 10% share.
_GATE = re.compile(r"<\s*0\.1\s*,\s*\d+(?:\.\d+)?\s*,")

# ``MAX(floor, MIN(ceiling, ramp))`` -- Kitsunite's smite clamp.
_CLAMP = re.compile(r"MAX\(\s*(?P<floor>\d+(?:\.\d+)?)\s*,\s*MIN\(\s*(?P<ceil>\d+(?:\.\d+)?)\s*,")

# C69-style: XLOOKUP("Ore", $C$6:$C$9, BYROW($D$6:$D$9, LAMBDA(row, ...)))
_XLOOKUP_NAME = re.compile(r'XLOOKUP\(\s*"([^"]+)"')


def _divisor_after(text, end):
    """100 if a ``/100`` follows the ramp (allowing the closing paren), else 1."""
    return 100 if re.match(r"\s*\)?\s*/\s*100", text[end:end + 12]) else 1


def _entry_from_payload(payload):
    """Return ``{base, max, divisor[, gated, floor, ceiling]}`` or ``None``."""
    m = _RAMP.search(payload)
    if not m:
        return None
    base = float(m.group("base"))
    if m.group("max") is not None:
        top = float(m.group("max"))
    else:
        top = base + float(m.group("delta"))
    entry = {
        "base": base,
        "max": top,
        "divisor": _divisor_after(payload, m.end()),
    }
    head = payload[:m.start()]
    if not _GATE.search(head):
        entry["gated"] = False
    clamp = _CLAMP.search(head)
    if clamp:
        entry["floor"] = float(clamp.group("floor"))
        entry["ceiling"] = float(clamp.group("ceil"))
    return entry


def _name_groups(s):
    """Ordered ``(names, payload_start)`` for every slot test in the formula.

    ``OR(...)`` groups yield all their names against one payload; every other
    slot test yields a single name.  Payloads run up to the next group.
    """
    groups = []
    spans = []
    for g in _OR_GROUP.finditer(s):
        groups.append((_ORE_TEST.findall(g.group(0)), g.start(), g.end()))
        spans.append((g.start(), g.end()))
    for t in _ORE_TEST.finditer(s):
        if any(lo <= t.start() < hi for lo, hi in spans):
            continue  # already covered by an OR group
        groups.append(([t.group(1)], t.start(), t.end()))
    groups.sort(key=lambda g: g[1])
    out = []
    for idx, (names, _start, end) in enumerate(groups):
        stop = groups[idx + 1][1] if idx + 1 < len(groups) else len(s)
        out.append((names, end, stop))
    return out


def parse_stat_matrix(formulas, stat_cells=None):
    """Derive ``{ore: {stat: {base, max, divisor, ...}}}`` from formula strings.

    ``formulas`` is ``{cell: formula_text}`` (load from the workbook with
    ``data_only=False``, or from a txt dump).  ``stat_cells`` defaults to
    ``STAT_CELLS``.
    """
    stat_cells = stat_cells or STAT_CELLS
    matrix = OrderedDict()
    for cell, stat in stat_cells.items():
        raw = formulas.get(cell)
        if not raw:
            continue
        s = _normalize(raw)

        for names, start, stop in _name_groups(s):
            entry = _entry_from_payload(s[start:stop])
            if entry is None:
                continue
            for ore in names:
                prev = matrix.setdefault(ore, {}).get(stat)
                if prev is not None and prev != entry:
                    raise ValueError(
                        f"{cell} ({stat}): conflicting ranges for {ore!r}: "
                        f"{prev} vs {entry}"
                    )
                matrix[ore][stat] = dict(entry)

        # XLOOKUP form (poison duration): the ore name is the lookup key and the
        # ramp lives in the BYROW/LAMBDA body that follows it.
        for m in _XLOOKUP_NAME.finditer(s):
            entry = _entry_from_payload(s[m.end():])
            if entry is None:
                continue
            matrix.setdefault(m.group(1), {})[stat] = dict(entry)

    return matrix
