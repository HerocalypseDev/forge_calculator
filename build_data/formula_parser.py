"""Extracts each ore's ``(base, max, divisor)`` from the workbook formulas.

Those stats live only in the ~18 stat cells of the ``DPS Calculator`` sheet,
every one built from the same share-scaling expression per slot -- ``IF(share<0.1,
0, (base+(max-base)*MIN((share-0.1)/0.2, 1))/divisor)`` -- combined per slot by
``IFS`` / nested ``IF`` / ``OR`` groups and aggregated with SUM/MAX/MIN.  This
walks the formula strings and pulls the triple out per ore; nothing is
hand-typed, so the matrix is exactly what the formulas encode.

The sheet uses four interchangeable spellings of the ramp, all handled here:

* ``(base+(max-base)*MIN(...))/100``  -- most percent stats
* ``(base+delta*MIN(...))/100``      -- C102 smite chance
* ``(base+(max-base)*MIN(...))``     -- C93 fire duration (divisor 1)
* ``base+delta*MIN(...)``            -- E109 lightning cooldown (no parens)

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
]


# cell -> stat name.  This is the ONLY hardcoded table in the build; the values
# themselves are always parsed from the formulas.  Addresses are Extended.xlsx.
STAT_CELLS = {
    "C72": "lethality",
    "C73": "crit_chance",
    "C74": "crit_dmg",
    "C75": "atk_speed",
    "C81": "moon",
    "C87": "explosion_dmg",
    "C88": "explosion_chance",
    "C91": "fire_dmg",
    "C92": "fire_chance",
    "C93": "fire_duration",
    "C96": "poison_dmg",
    "C97": "poison_chance",
    "C98": "poison_duration",
    "C101": "smite_dmg",
    "C102": "smite_chance",
    "C105": "blackhole_dmg",
    "C109": "lightning_dmg",
    "E109": "lightning_cooldown",
    "C110": "lightning_chance",
}

# C106 (black-hole proc chance) is the constant IF(COUNTIF(...)>=0.1,0.3,0) and
# is handled directly in the engine, not in the matrix.


_CELL_HEADER = re.compile(r"^\s*([A-Z]{1,3}[0-9]+):\s*$")


def load_formulas_from_txt(path):
    """Load ``{cell: formula}`` from a formula-dump text file.

    Handles the format of the ``all_formulas*.txt`` dumps: a cell header line
    (``  C87:``), then one or more indented formula lines (multi-line formulas
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
_ORE_TEST = re.compile(r'\bC[6-9]\s*=\s*"([^"]+)"')

# An OR(...) group of slot tests sharing one payload, e.g.
#   OR(C6="Gargantuan",C6="Fireite")
_OR_GROUP = re.compile(r'OR\(\s*(?:C[6-9]\s*=\s*"[^"]+"\s*,?\s*)+\)')

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
# every stat except lightning cooldown (E109), which uses 99 as its "no lightning"
# sentinel; either way the ore contributes nothing below 10% share.
_GATE = re.compile(r"<\s*0\.1\s*,\s*\d+(?:\.\d+)?\s*,")

# ``MAX(floor, MIN(ceiling, ramp))`` -- Kitsunite's smite clamp.
_CLAMP = re.compile(r"MAX\(\s*(?P<floor>\d+(?:\.\d+)?)\s*,\s*MIN\(\s*(?P<ceil>\d+(?:\.\d+)?)\s*,")

# C98-style: XLOOKUP("Ore", $C$6:$C$9, BYROW($D$6:$D$9, LAMBDA(row, ...)))
_XLOOKUP_NAME = re.compile(r'XLOOKUP\(\s*"([^"]+)"')

_FLAT_PAYLOAD = re.compile(r"^\s*,\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<pct>/\s*100)?\s*(?:,|\)|$)")

_COUNTIF_FLAT = re.compile(
    r'COUNTIF\(\s*\$?C\$?6:\$?C\$?9\s*,\s*"(?P<name>[^"]+)"\s*\)\s*,\s*'
    r"(?P<value>\d+(?:\.\d+)?)\s*(?P<pct>/\s*100)?\s*,"
)


_SUMPRODUCT_RAMP = re.compile(
    r'(?P<open>SUMPRODUCT\()\s*\(\s*C6:C9\s*=\s*"(?P<name>[^"]+)"\s*\)'
    r".{0,200}?>=\s*0\.1\s*\)\s*\*\s*\(\s*(?P<base>\d+(?:\.\d+)?)\s*\+\s*(?P<delta>\d+(?:\.\d+)?)\s*\*\s*IF\("
)

_SUMPRODUCT_PCT = re.compile(r"\s*/\s*100\b")


def _matching_paren(s, open_end):
    depth = 1
    for i in range(open_end, len(s)):
        if s[i] == "(":
            depth += 1
        elif s[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return len(s) - 1


def _flat_entry(value, pct):
    value = float(value)
    return {"base": value, "max": value, "divisor": 100 if pct else 1, "gated": False}


def _divisor_after(text, end):
    """100 if a ``/100`` follows the ramp (allowing the closing paren), else 1."""
    return 100 if re.match(r"\s*\)?\s*/\s*100", text[end:end + 12]) else 1


_GATED_FLAT = re.compile(
    r"^\s*,\s*IF\(\s*SUM\(\$D\$6:\$D\$9\)\s*=\s*0\s*,\s*\d+(?:\.\d+)?\s*,\s*IF\(\s*D[6-9]\s*/\s*SUM\(\$D\$6:\$D\$9\)"
    r"\s*<\s*0\.1\s*,\s*\d+(?:\.\d+)?\s*,\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<pct>/\s*100)?\s*\)\s*\)"
)


def _entry_from_payload(payload):
    """Return ``{base, max, divisor[, gated, floor, ceiling]}`` or ``None``."""
    m = _RAMP.search(payload)
    gated_flat = _GATED_FLAT.match(payload)
    if gated_flat and (not m or m.start() > gated_flat.end()):
        value = float(gated_flat.group("value"))
        return {"base": value, "max": value, "divisor": 100 if gated_flat.group("pct") else 1}
    if not m:
        flat = _FLAT_PAYLOAD.match(payload)
        return _flat_entry(flat.group("value"), flat.group("pct")) if flat else None
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

        for m in _COUNTIF_FLAT.finditer(s):
            matrix.setdefault(m.group("name"), {})[stat] = _flat_entry(m.group("value"), m.group("pct"))

        for m in _SUMPRODUCT_RAMP.finditer(s):
            base = float(m.group("base"))
            matrix.setdefault(m.group("name"), {})[stat] = {
                "base": base,
                "max": base + float(m.group("delta")),
                "divisor": 100 if _SUMPRODUCT_PCT.match(s[_matching_paren(s, m.end("open")) + 1:]) else 1,
            }

    return matrix
