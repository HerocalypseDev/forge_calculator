"""Diff UpdatedSpreadsheet.xlsx per-ore stat ranges against Web/mediawiki/Data-Ores.json.

Dev-only audit helper. Parses the slot-1 (C6/D6) branch of each DPS Calculator
stat formula -- all four slots repeat identical ranges -- and reports any ore
range that is missing, extra, or numerically different in the shipped JSON.
"""
import json
import re
import sys

import openpyxl

# workbook cell -> (engine stat key, divisor)
CELL_STATS = {
    "C45": ("lethality", 100),
    "C46": ("crit_chance", 100),
    "C47": ("crit_dmg", 100),
    "C48": ("atk_speed", 100),
    "C53": ("moon", 100),
    "C58": ("explosion_dmg", 100),
    "C59": ("explosion_chance", 100),
    "C62": ("fire_dmg", 100),
    "C63": ("fire_chance", 100),
    "C64": ("fire_duration", 1),
    "C67": ("poison_dmg", 100),
    "C68": ("poison_chance", 100),
    "C69": ("poison_duration", 1),
    "C72": ("smite_dmg", 100),
    "C73": ("smite_chance", 100),
    "C76": ("blackhole_dmg", 100),
    "C80": ("lightning_dmg", 100),
    "C81": ("lightning_chance", 100),
    "E80": ("lightning_cooldown", 1),
}

# phys_dmg/move_speed/berserk_duration have no DPS Calculator formula cell --
# they're parsed from each ore's own trait10/trait30 sentences instead. This
# regex is deliberately reimplemented here (not imported from build_data) so
# the audit is an independent cross-check, not a tautology.
BERSERK_TRAIT_RE = re.compile(
    r"([+-]?\d+(?:\.\d+)?)%\s*Physical\s*Damage\s*and\s*"
    r"([+-]?\d+(?:\.\d+)?)%\s*Movement\s*Speed\s*for\s*"
    r"(\d+(?:\.\d+)?)\s*seconds?\s*when\s*HP\s*drops\s*below\s*35%",
    re.IGNORECASE,
)

# a slot-1 ore test: C6="Name"  or  OR(C6="A",C6="B",...)
NAME_RE = re.compile(r'C6\s*=\s*"([^"]+)"')
# the scaling payload that follows it: (base+(max-base)*MIN(  or  (base+K*MIN(
RAMP_RE = re.compile(
    r'[(,]\s*(-?[\d.]+)\s*\+\s*(?:\(\s*(-?[\d.]+)\s*-\s*-?[\d.]+\s*\)|(-?[\d.]+))\s*\*\s*MIN\('
)
FLAT_RE = re.compile(r'^\s*,\s*(-?[\d.]+)\s*(?:/\s*100)?\s*,')
GATED_FLAT_RE = re.compile(r'^\s*,\s*IF\(SUM\(\$D\$6:\$D\$9\)=0,[\d.]+,IF\(D6/SUM\(\$D\$6:\$D\$9\)<0\.1,[\d.]+,(-?[\d.]+)(?:/100)?\)\)')


def parse_cell(formula):
    """Return {ore_name: (base, max)} for the slot-1 branch of one formula."""
    out = {}
    hits = list(NAME_RE.finditer(formula))
    for idx, m in enumerate(hits):
        name = m.group(1)
        end = hits[idx + 1].start() if idx + 1 < len(hits) else len(formula)
        seg = formula[m.end():end]
        flat = FLAT_RE.match(seg) or GATED_FLAT_RE.match(seg)
        if flat:
            out[name] = (float(flat.group(1)), float(flat.group(1)))
            continue
        r = RAMP_RE.search(seg)
        if not r:
            continue
        base = float(r.group(1))
        if r.group(2) is not None:      # (base+(max-base)*MIN(
            mx = float(r.group(2))
        else:                            # (base+K*MIN(
            mx = base + float(r.group(3))
        # OR(C6="A",C6="B") groups share one payload; only the last name in the
        # group precedes it, so earlier names in the same group get the same range
        out.setdefault(name, (base, mx))
        if out[name] != (base, mx):
            print("  !! conflicting ranges for %s: %s vs %s" % (name, out[name], (base, mx)))
    return out


def parse_or_groups(formula):
    """C64 uses OR(C6="A",C6="B",...) -- map every name in a group to its payload."""
    out = {}
    for grp in re.finditer(r'OR\(((?:\s*C6\s*=\s*"[^"]+"\s*,?)+)\)', formula):
        names = NAME_RE.findall(grp.group(1))
        seg = formula[grp.end():]
        r = RAMP_RE.search(seg)
        if not r:
            continue
        base = float(r.group(1))
        mx = float(r.group(2)) if r.group(2) is not None else base + float(r.group(3))
        for n in names:
            out[n] = (base, mx)
    return out


def main(xlsx, json_path):
    wb = openpyxl.load_workbook(xlsx, data_only=False)
    ws = wb["DPS Calculator"]

    book = {}   # stat -> {ore: (base, max, divisor)}
    for cell, (stat, div) in CELL_STATS.items():
        v = ws[cell].value
        if v is None:
            continue
        v = getattr(v, "text", v)
        ranges = parse_or_groups(v) if "OR(" in v else {}
        ranges.update({k: r for k, r in parse_cell(v).items() if k not in ranges})
        book[stat] = {n: (b, m, div) for n, (b, m) in ranges.items()}


    # berserk-group traits: independently re-derive from _OptionsCrafter's own
    # trait10 (D) / trait30 (E) text, cross-checking build_data's extraction
    wsv = openpyxl.load_workbook(xlsx, data_only=True)["_OptionsCrafter"]
    book.setdefault("phys_dmg", {})
    book.setdefault("move_speed", {})
    book.setdefault("berserk_duration", {})
    for row in wsv.iter_rows(min_row=61, max_row=209):
        name = (row[0].value or "").strip()
        if not name:
            continue
        t10, t30 = row[3].value or "", row[4].value or ""
        m10, m30 = BERSERK_TRAIT_RE.search(t10), BERSERK_TRAIT_RE.search(t30)
        if not m10 or not m30:
            continue
        pd10, ms10, dur10 = (float(g) for g in m10.groups())
        pd30, ms30, dur30 = (float(g) for g in m30.groups())
        book["phys_dmg"][name] = (pd10, pd30, 100)
        book["move_speed"][name] = (ms10, ms30, 100)
        book["berserk_duration"][name] = (dur10, dur30, 1)

    data = json.load(open(json_path, encoding="utf-8"))
    ores = data["ores"] if isinstance(data, dict) and "ores" in data else data
    js = {}
    for o in ores:
        for stat, rng in (o.get("stats") or {}).items():
            js.setdefault(stat, {})[o["name"]] = (
                float(rng["base"]), float(rng["max"]), int(rng.get("divisor", 100))
            )

    catalog = {o["name"] for o in ores}
    for stat, ranges in book.items():
        for ore in sorted(set(ranges) - catalog):
            print("FORMULA-ONLY     %-20s %-26s workbook=%s (no catalog ore has this name)" % (stat, ore, ranges.pop(ore)))

    problems = 0
    for stat in sorted(set(book) | set(js)):
        b = book.get(stat, {})
        j = js.get(stat, {})
        for ore in sorted(set(b) | set(j)):
            bv, jv = b.get(ore), j.get(ore)
            if bv == jv:
                continue
            problems += 1
            if jv is None:
                print("MISSING in JSON  %-20s %-26s workbook=%s" % (stat, ore, bv))
            elif bv is None:
                print("EXTRA in JSON    %-20s %-26s json=%s" % (stat, ore, jv))
            else:
                print("MISMATCH         %-20s %-26s workbook=%s json=%s" % (stat, ore, bv, jv))
    print("\n%d ore-range problems" % problems)
    return problems


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1], sys.argv[2]) else 0)
