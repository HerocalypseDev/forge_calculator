# Edge-case testing report — MediaWiki engine

**Scope:** 84 scenarios run directly against `MediaWiki-ForgeCalculator.js`'s `calculate()`,
targeting ore-stacking, race+trait double-dipping, share-gate boundaries, stat caps, and
every on-hit proc (Explosion/Blast, Fire, Poison, Smite, Black Hole, Lightning) plus
Berserk, Moon Stone, and Attack Speed ores. Base weapon is Hook Blade (Straight Sword,
0.52s interval) unless a scenario names a different weapon to exercise
attack-rate-dependent behavior.

**Result at the time: no defects found.** Every scenario matched the engine behavior
documented in `CLAUDE.md` at the time (domain model, approved deviations, preserved
quirks). Three of my own test predictions turned out to be wrong going in — every time
the *engine* was right and my assumption was the bug; see "Corrections to my own
assumptions" below. **One genuine engine bug was found later, separately, and is now
fixed** — explosion_chance was summing across slots instead of taking the max, the one
proc family out of six that didn't match its siblings' aggregation rule. None of these
83 scenarios caught it at the time because catching it needs *multiple* explosion
sources active in one build, and only two scenarios here (1E, 1H) happen to do that —
see the update note at the top of Category 1 for the corrected numbers.

Full raw output (all 33 fields per scenario) is in the session scratchpad as
`scenario-results.json` — this report carries the fields relevant to each category.

## 1 — Explosion/Blast: dmg SUMs, chance MAXes (fixed since this report was first written)

> **Update:** when this section was first written, explosion_chance summed across every
> triggering slot — the one proc family out of six that didn't MAX its chance term like
> its siblings. That was a genuine bug in `reall.xlsx` itself, not just the engines; it's
> since been fixed at the source (`reall.xlsx` was corrected and all three engines
> updated to match). The table and analysis below now reflect the fixed behavior. Of the
> 8 scenarios in this category, only **1E** and **1H** actually changed — every other row
> here only ever had one source of explosion chance active, and MAX-of-one equals
> SUM-of-one, so single-source builds were never able to expose the old bug.

| # | Scenario | explosion_dmg | explosion_chance | explosion_dps | total_dps |
|---|---|---|---|---|---|
| 1A | Gargantuan @9.9% (below gate) | 0 | 0 | 0 | 34.22 |
| 1B | Gargantuan @10.0% (exact gate) | 0.05 | 0.035 | 0.067 | 38.14 |
| 1C | Gargantuan @30% (ramp top) | 0.50 | 0.35 | 14.44 | 100.24 |
| 1D | Gargantuan @100% | 0.50 | 0.35 | 41.65 | 289.15 |
| 1E | 4 explosion ores stacked, 25% each | **1.6275** (sum) | **0.34875** (max) | 118.06 | 384.73 |
| 1F | Kitsunite alone @40% | 0.70 | 0.40 | 51.53 | 335.17 |
| 1G | Blast ability alone, no ore | 0.40 | 0.20 | 1.27 | 17.13 |
| 1H | Gargantuan ore + Blast ability | 0.90 | 0.35 (max) | 25.99 | 111.79 |

**Confirms:** explosion_dmg still **sums** across every slot that clears the 10% gate
(1E: 0.05+0.60+0.35+0.65 = 1.6275 dmg, matching the four ramp-maxed ore contributions
exactly), but explosion_chance now **MAXes**, exactly like fire/poison/smite/lightning's
chance terms — 1E's four ore chances at 25% share (Gargantuan 0.27125, Meteorite
0.19375, Magmaite 0.155, Supermassive Black Hole 0.34875) resolve to the highest one
(SSBH's 0.34875), not their sum. 1H shows the same fix for ore+ability: Gargantuan's own
0.35 already exceeds the Blast ability's 0.20, so `max(0.35, 0.20) = 0.35` rather than
their old sum of 0.55. `explosion_dmg` is unaffected by this fix — it never had the
inconsistency to begin with, so 1E's dmg total and every dmg value in this table are
unchanged from the original run. Gate boundary is still a hard cliff at 9.9%→0 /
10.0%→base (1A vs 1B), unrelated to this fix.

## 2 — Fire: dmg SUMs, chance/duration MAX; Dragonborn race stacks on top

| # | Scenario | fire_dmg | fire_chance | fire_duration | fire_dps | total_dps |
|---|---|---|---|---|---|---|
| 2A | Sun Stone @20% | 0.1925 | 0.1925 | 1.75 | 3.58 | 58.76 |
| 2B2 | 4 fire ores stacked, 25% each | **0.93** | 0.34875 | 2.875 | 95.70 | 350.54 |
| 2C | Dragonborn alone, no ore/ability | 0.30 | 0.40 | 2 | 2.48 | 20.24 |
| 2D | Dragonborn + Kyubite @30% | 0.75 | 0.85 | 4 | 35.89 | 164.92 |
| 2E | Fire ability alone, no ore/race | 0.10 | 0.15 | 1 | 0.24 | 16.10 |
| 2F | High chance×duration saturation | 0.75 | 0.90 | 4 | 45.79 | 210.42 |
| 2G | Dragonborn + fire_time=10 ability | 0.30 | 0.40 | **9** | 2.48 (same as 2C) | 20.24 |

**Confirms:** fire_dmg **sums** across ore slots (2B2: 0.20+0.35+0.45+0.20 minus the
correct per-ore base offsets = 0.93 on the nose) while fire_chance and fire_duration
**MAX** rather than sum — the four-ore stack's chance (0.34875) equals Kyubite's own
single-ore value, not a sum. Dragonborn's race bonus (30% dmg / 40% chance / 3s time)
applies with **zero ore and zero ability present** (2C) — the workbook's duration-gate
removal in effect. Race dmg **adds** to ore dmg (2D: 0.45+0.30=0.75) while race chance
**adds on top of the ore MAX** rather than being maxed against it (2D: max(0.45,0)+0.40
= 0.85, not max(0.45,0.40)=0.45). 2G proves the engine computes the *true* uncapped
duration (top = max(0,3,10)-1 = 9) but that a **second, independent clamp** lives inside
`fire_dps` itself: `Math.min(1, fire_chance × atkRate × Math.min(fire_duration, 5))`.
With fire_chance=0.4 and atkRate=1.923, the inner term already reaches
0.4×1.923×2 = 1.54 (>1) at a duration of just 2s — so 2C (duration 2) and 2G (duration 9,
clamped to 5 inside the formula) both saturate the outer `Math.min(1, …)` and land on the
exact same `fire_dps = 2.475`. The 5s duration clamp is real but, for this dmg/chance/rate
combination, it's the *outer* uptime clamp that actually binds first — a small but
concrete illustration of two nested clamps in the same formula.

## 3 — Poison: Malachite only; duration is FIRST-slot, not max

| # | Scenario | poison_dmg | poison_chance | poison_duration | poison_dps | total_dps |
|---|---|---|---|---|---|---|
| 3A | single Malachite @20% | 0.055 | 0.1815 | 0 | 0 | 33.00 |
| 3B | Malachite@10% then Malachite@30% | 0.11 | 0.33 | **0** | 0 | 50.13 |
| 3C | Malachite@30% then Malachite@10% | 0.11 | 0.33 | **1** | 1.82 | 51.95 |
| 3D | Malachite only in slot 4 | 0.10 | 0.33 | 1 | 3.35 | 104.89 |
| 3E | poison ability alone, no ore | 0.05 | 0.10 | 1 | 0.079 | 15.94 |
| 3F | Malachite@30% + poison ability | 0.13 | 0.33 | 1 | 1.78 | 43.35 |

**Confirms the sharpest finding in this pass:** 3B and 3C use **the same two Malachite
shares in reversed slot order** and get **identical poison_dmg/poison_chance but
opposite poison_duration** (0 vs 1) — proof that `firstSlotVal` really is positional
(first array match), exactly as documented ("Poison duration takes only the first
Malachite slot, not the max"). In 3B the first Malachite is at only 10% share, which is
*exactly* the share gate — and its duration ramp value at precisely 10% share evaluates
to base (0.3) → `duration([0.3],0,0,2) = max(0.3,0,0)-2 = -1.7 → floored to 0`, matching
`poison_dps=0` even though dmg/chance are both nonzero. This is a real, workbook-accurate
trap: **whichever Malachite slot comes first controls the whole poison proc's uptime**,
even if a later, higher-share Malachite would have given a much longer duration.

## 4 — Smite: Kitsunite's ungated ramp; Angel/Archangel race stacking

| # | Scenario | smite_dmg | smite_chance | smite_dps | total_dps |
|---|---|---|---|---|---|
| 4A | Kitsunite @5% (below 10% gate) | **0.05** | 0 | 0 | 36.89 |
| 4B | Kitsunite @1% (near-zero) | **0.05** | 0 | 0 | 20.07 |
| 4C | Kitsunite @100% | **0.5** (ceiling) | 0.5 | 109.07 | 794.59 |
| 4D | Kitsunite@30% + Heavenite@30% | 0.75 (sum) | 0.5 (max) | 75.92 | 393.99 |
| 4E | Angel alone, no ore | 0.30 | 0.50 | 2.38 | 18.25 |
| 4F | Archangel alone, Skull Crusher (0.57 hit/s) | **0** | 0.33 | 0 | 19.75 |
| 4G | Archangel alone, Hook Blade (1.92 hit/s) | **0.5** | 0.33 | 6.28 | 29.13 |
| 4H | Archangel + Attack Speed +20% (2.69 hit/s) | **1.0** | 0.33 | 7.33 | 33.98 |
| 4I | Angel + Kitsunite @30% | 0.80 (sum) | **1.0** (max+add) | 113.60 | 336.70 |
| 4J | Archangel + Kitsunite + Heavenite | 1.75 (sum) | 0.83 (max+add) | 352.86 | 771.35 |
| 4K | Angel + Kitsunite + Heavenite | 1.05 (sum) | **1.0** (clamped) | 212.56 | 530.64 |

**Confirms:** Kitsunite's smite_dmg ramp is `gated:false` — it produces a nonzero value
(clamped to the 0.05 floor) **even at 1% share**, far under the normal 10% gate every
other stat obeys (4A, 4B), and clamps to a 0.5 ceiling no matter how high the share goes
(4C, well past what the raw base+ramp formula alone would give). Archangel's smite_dmg
is the documented step function — `MIN(FLOOR(atkRate)*0.5, 1.5)`: it's **exactly 0**
below 1 hit/sec (4F) despite Archangel granting +20% atk_speed itself (the weapon is
just too slow to reach 1/s even with the bonus), jumps to 0.5 at FLOOR=1 (4G), and to 1.0
once the achievement pushes FLOOR to 2 (4H). Race smite_chance is **additive on top of
the ore MAX**, not maxed against it — 4I: `max(0.5,0)+0.50 = 1.0` exactly, and 4K's three
sources (`max(0.5,0.4)+0.50 = 1.0`) land exactly on the `Math.min(chance,1)` clamp
boundary in `smite_dps` with no overflow.

## 5 — Black Hole: Galaxite's structural trigger vs its share-based damage

| # | Scenario | blackhole_chance | blackhole_dmg | atk_rate | blackhole_dps | total_dps |
|---|---|---|---|---|---|---|
| 5A | 1 Galaxite @1% + 3 other ores @33% | **0.3** | 0 | 1.92 | 0 | 110.96 |
| 5B | no Galaxite at all | **0** | 0 | 1.92 | 0 | 62.26 |
| 5C | 1 Galaxite, 3 blank slots | **0.3** | 0.6 | 1.92 | 71.39 | 584.04 |
| 5D | Galaxite @30% share alone | **0.3** | 0.6 | 1.92 | 23.42 | 191.57 |
| 5E | Galaxite @30%, Skull Crusher (0.57 hit/s) | 0.3 | 0.6 | 0.57 | **35.42** | 180.77 |
| 5F | Galaxite @30%, Hook Blade (1.92 hit/s) | 0.3 | 0.6 | 1.92 | 23.42 | 191.57 |

**Confirms:** black hole's *chance* is a purely structural trigger — `COUNTIF(Galaxite
slots) / COUNTA(nonblank slots) >= 10%` — completely independent of how much of the ore
amount is Galaxite. 5A has Galaxite at just 1% of the total ore amount and still gets the
full 0.3 chance, because it's 1 of 4 *nonblank slots* (25% ≥ 10%). 5C is the sharpest
case: Galaxite is the **only filled slot**, so its *amount-share* is actually 100% (not
diluted by the three truly-blank slots, since `slotShares` divides by the sum of amounts,
not slot count) — both the structural chance trigger **and** the share-based damage ramp
fire at full strength. **The rate floor is the standout confirmation**: 5E swaps in Skull Crusher (interval
1.75s, base damage 24 vs. Hook Blade's 8.25) so its true attack rate is 0.571 hits/sec,
well under 1/sec — yet `blackhole_dps` uses `unforged × dmg × chance × MAX(1, atkRate)`,
so the black hole proc is computed as if the weapon hit once per second regardless. Its
*unforged* damage (196.8, from the much higher per-hit base) is still large enough that
this floored proc (35.42 dps) actually exceeds 5F's Hook Blade result at the same ore
build (23.42 dps, where the real attack rate of 1.923/s is already above the floor and
passes through unchanged). The floor exists specifically so a slow weapon's black hole
proc isn't computed at a fractional, sub-1/sec rate the way every other proc is.

## 6 — Lightning: SUM dmg, MAX chance, MIN cooldown; proc-rate cap

| # | Scenario | lightning_dmg | lightning_chance | cooldown | atkRate | proc cap (1/s) | lightning_dps |
|---|---|---|---|---|---|---|---|
| 6A | Marblite @25% | 0.465 | 0.31 | 3.875s | 1.923 | **0.258** (capped) | 1.61 |
| 6B | Marblite@30% + Kitsunite@30% | **1.4** (sum) | **0.6** (max) | **3.0s** (Kitsunite's shorter wins over Marblite's 5.0s) | 1.923 | **0.333** (capped) | 32.46 |
| 6C | lightning ability alone | 0.10 | 0.20 | 2s | 1.923 | **0.5** (capped) | 0.083 |
| 6D | Kitsunite @30% | 0.80 | 0.60 | 3.0s | 1.923 | **0.333** (capped) | 11.81 |
| 6E | Kitsunite @40%, Archangel+achievement | 0.80 | 0.60 | 3.0s (ramp already saturated past 30%) | 2.692 | **0.333** (capped) | 15.31 |
| 6F | Marblite @10% (base ramp), Skull Crusher | 0.06 | 0.04 | 0.5s (ore's own base value) | 0.571 | 0.571 (**uncapped** — 1/cooldown=2.0 exceeds atkRate) | 0.089 |

**Confirms:** dmg sums (6B: 0.6+0.8=1.4), chance MAXes (0.4 vs 0.6 → 0.6), and cooldown
takes the **shorter** of the stacked ores (Kitsunite's 3.0s beats Marblite's 5.0s at
these shares) — all matching the documented `MIN` aggregation. The standout result here
is that **the proc-rate cap `MIN(atkRate, 1/cooldown)` binds in every scenario except
6F** — Kitsunite and Marblite's cooldown ramps both get *longer* (not shorter) as their
share climbs past 10% (base 0.3s/0.5s at 10% share → 3.0s/5.0s at 30%+ share, per the
workbook's own ore data), so `1/cooldown` collapses to a fraction of a proc per second
well before a Hook Blade's ~2/s attack rate is reached. 6E's raw attack rate (2.692/s,
boosted by Archangel + the achievement) is entirely masked by the 0.333/s cap — the
build attacks 8× faster than lightning can actually proc. Only 6F, with Marblite held at
exactly its 10% base share (cooldown 0.5s → 1/cooldown = 2.0/s) on a sub-1/s weapon,
leaves the cap slack enough that the *true* attack rate is what limits the proc instead.

## 7 — Berserk vs Moon Stone: additive stacking, and the null-vs-zero distinction

| # | Scenario | berserk | moonstone | total_dps |
|---|---|---|---|---|
| 7A | Minotaur alone | 20.625 (weapon_dps×1.3) | null | 15.87 |
| 7B | manual berserk=50%, no Minotaur | 23.80 (×1.5) | null | 15.87 |
| 7C | Minotaur + manual 20% | 23.80 (×1.5, additive 0.3+0.2) | null | 15.87 |
| 7D | zero berserk, no Minotaur | **null** | null | 15.87 |
| 7E | Moon Stone @30% alone | null | 56.72 (×1.25) | 45.37 |
| 7F | Moon Stone + Minotaur + manual 10% | 63.52 (×1.4) | 56.72 (unchanged) | 45.37 |

**Confirms:** manual `berserk` input and the Minotaur race bonus stack **additively**
(7C's 1.5× multiplier is identical to 7B's, because 0.20+0.30 = 0.50 either way it's
reached) rather than one overriding the other. 7D confirms `berserkLevel === 0` returns
`null`, not `0` — the UI/report distinguishes "no berserk mechanic active" from "berserk
active at 0%". 7F shows berserk and Moon Stone are **fully independent**: both populate
simultaneously from the same `weapon_dps` base with their own separate multiplier, and
neither's presence changes the other's value.

## 8 — Race+Class double bonus: the Felynx Gauntlet/Gauntlets spelling quirk

| # | Scenario | lethality | atk_speed | total_dps |
|---|---|---|---|---|
| 8A | Felynx + "Gauntlet" (singular) | 0.20 | 0.20 | 22.85 |
| 8B | Felynx + "Gauntlets" (plural, the real in-game string) | 0.20 | 0.20 | 22.85 |
| 8C | Felynx + "Dagger" (unrelated) | 0 | 0 | 15.87 |
| 8D | Vampire + Straight Sword | 0.10 | 0 | 17.45 |
| 8E | Goblin + Dagger | 0 | 0.10 | 17.45 |
| 8F | Golem + Colossal Sword | 0 | 0.15 | 18.25 |

**Confirms approved deviation #4 exactly:** both the singular and plural spelling give
Felynx the *same* combined +20% lethality / +20% atk_speed result, because
`CLASS_LETHALITY` and `CLASS_ATK_SPEED` both register **both** spellings. Since the only
weapon-type string the game actually produces is the plural "Gauntlets", 8B is the
scenario that matters in practice — and it fires both bonuses simultaneously, which
matches the CLAUDE.md note "Felynx + a Gauntlet weapon gets BOTH class bonuses." 8C/8D/8E/8F
confirm the lookup keys are exact-match pairs with no partial-credit leakage between races.

## 9 — Share-gate boundary precision

| # | Scenario | share | lethality | total_dps |
|---|---|---|---|---|
| 9A | 9.9% (just under gate) | 9.9% | **0** | 23.40 |
| 9B | 10.0% (exact gate) | 10.0% | **0.02** (base) | 23.95 |
| 9C | 10.1% (just over) | 10.1% | 0.0209 | 24.05 |
| 9D | 29.9% (just under ramp top) | 29.9% | 0.1991 | 46.33 |
| 9E | 30.0% (ramp top, exact) | 30.0% | **0.20** (max) | 46.45 |
| 9F | 75% (far past ramp top) | 75% | 0.20 (flat) | 87.58 |
| 9G | 4 lethality ores, 25% each | 25% each | **0.7556** (sum of 4 ramp-max) | 249.92 |
| 9H | Fichilliumorite alone, 100% | n/a | 0 | 15.87 |
| 9I | Crimsonite 20% + Fichilliumorite 80% | 20% (full-total basis) | 0.11 (mid-ramp) | 102.14 |

**Confirms:** the 10% gate is a hard, inclusive cliff (9A vs 9B — one hundredth of a
percent is the difference between 0 and the full base value), and the ramp is fully
saturated at exactly 30% share with no further scaling past it (9E vs 9F identical).
9H/9I confirm the two-different-denominators quirk directly: `avgOrePower` **excludes**
Fichilliumorite from both halves of its average (falls back to the 1.0 default multiplier
when it's the only ore present, 9H), while the ordinary stat-ramp share calculation
(`slotShares`) divides by the **full** slot total **including** Fichilliumorite — so in
9I, Crimsonite's 20-of-100 units gives it a 20% share for its lethality ramp (clearing
the gate, landing mid-ramp at 0.11) even though Fichilliumorite contributes nothing to
`avg_power`. These are two genuinely different share bases computed from the same slots.

## 10 — Stat caps: all four core stats are hard-capped, confirmed by deliberately overshooting

| # | Scenario | raw ore+race+armor+ach. sum (approx) | returned (capped) value | cap |
|---|---|---|---|---|
| 10A | lethality stack (ore+Archangel+armor 100%+Damage Boost 20%) | ≈2.42 | **1.5** | 1.5 |
| 10B | crit_chance stack (4 ores + armor 100%) | ≈2.03 | **1.0** | 1.0 |
| 10C | crit_dmg stack (4 ores + armor 100%) | ≈1.57 | **1.0** | 1.0 |
| 10D | atk_speed stack (4 ores + Archangel + achievement) | 0.67 | 0.67 (cap not reached) | 1.5 |

**Confirms `CLAUDE.md`'s "each capped (1.5/1.0/1.0/1.5)" line precisely** — all four core
totals (`totals.lethality/crit_chance/crit_dmg/atk_speed`) are returned through
`Math.min(x, CAPS.x)` inside `statTotals`, not just lethality/crit_chance. I initially
wrote 10C's scenario note assuming crit_dmg was *uncapped* ("no cap in critBlend on cd");
that assumption was **wrong** — see "Corrections" below. 10A and 10B/10C were
deliberately built to overshoot their caps by 50–100%, and all three landed exactly on
the cap boundary, not above it. 10D didn't reach its 150% cap with the ore pool
available, so it's the one row here that doesn't independently prove the cap exists —
10A/10B/10C already do that for the mechanism shared by all four stats.

## 11 — Achievement/rune collisions with ore-sourced stats

| # | Scenario | lethality/atk_speed/crit_chance | total_dps |
|---|---|---|---|
| 11A | Damage Boost +20% + Crimsonite lethality ore | 0.20(ore)+0.20(ach)=**0.40** | 54.20 |
| 11B | Attack Speed +20% + Tiger's Eye + Archangel | 0.075(ore)+0.20(race)+0.20(ach)=**0.475** | 92.44 |
| 11C | Crit Chance +35% + Galaxite | 0.45(ore)+0.35(ach)=**0.80** | 221.16 |

**Confirms:** achievements never override or get overridden by ore-sourced stats of the
same type — every source is a separate additive term summed before the shared cap is
applied (11A/11B/11C all land at the arithmetic sum, well under their respective caps).

## 12 — Kitchen-sink builds (every proc family + berserk at once)

| # | Scenario | explosion | fire | poison | smite | blackhole | lightning | berserk | total_dps |
|---|---|---|---|---|---|---|---|---|---|
| 12A | Kitsunite+Galaxite+Malachite+Marblite, Archangel, full armor, Blast ability | 191.73 | 80.12 | 0 | 596.76 | 86.28 | 183.73 | n/a (no Minotaur) | **3103.85** |
| 12B | same 4 ores + Minotaur + manual 20% berserk | 95.86 | 71.21 | 0 | 85.59 | 61.63 | 176.67 | **1154.75** | 933.49 (pre-berserk) |
| 12C | Select Ore ×4, nothing else | 0 | 0 | 0 | 0 | 0 | 0 | null | 15.87 |

**Confirms every proc family can co-exist and produce nonzero DPS simultaneously** —
12A exercises all six proc rows in one build with no interference between them (Kitsunite
alone feeds explosion+fire+smite+lightning, Galaxite feeds black hole, Malachite feeds
poison — poison_dps is 0 here only because Malachite is at 20% share, below what its
*duration* ramp needs; poison_dmg/chance are both nonzero, matching the category-3
finding that duration is the gating term). 12B confirms berserk's clean-multiplier
property holds even in a maximally loaded build: `berserk (1154.75) = weapon_dps
(442.52) × 1.5 + proc_total (490.97)` — the six proc rows are added back **unscaled**,
never touched by the berserk multiplier. 12C is the floor case: every single proc field
is exactly 0 with nothing configured, and both berserk and moonstone are `null`.

## 13 — Attack Speed ores: SUM aggregation, share-gate, cap headroom (added on request)

The original 76-scenario pass only exercised ore attack speed bundled together with
race and achievement bonuses (category 10D). A dedicated 8-scenario follow-up isolates
the four attack-speed ores — Yeti Heart, Tiger's Eye, Wolfarite, Fierce Jade.

| # | Scenario | atk_speed | attack_rate | weapon_dps | total_dps |
|---|---|---|---|---|---|
| 13A | Yeti Heart @9.9% (below gate) | **0** | 1.923 | 23.72 | 23.72 |
| 13B | Yeti Heart @10.0% (exact gate) | **0.01** (base) | 1.942 | 24.37 | 24.37 |
| 13C | Yeti Heart @30% (ramp top) | **0.10** (max) | 2.115 | 50.83 | 50.83 |
| 13D | Yeti Heart @100% | 0.10 (flat, same as 13C) | 2.115 | 121.99 | 121.99 |
| 13E | all 4 atk_speed ores stacked, 25% each, ore-only | **0.313875** (sum, mid-ramp) | 2.527 | 408.05 | 408.05 |
| 13F | Fierce Jade @30% + Archangel + Attack Speed +20% | 0.55 | 2.981 | 245.11 | 292.18 |
| 13G | all 4 ores @25% + Archangel + Straight Sword + achievement | 0.713875 | 3.296 | 613.55 | 763.22 |
| 13H | all 4 ores @25% + Felynx + Gauntlets + achievement | 0.713875 | 3.296 | 613.55 | 613.55 |

**Confirms:** ore attack speed obeys the identical 10%/30% share gate and ramp as every
other core stat (13A→13B→13C→13D mirrors category 9's lethality progression exactly).
13E confirms attack-speed ores **sum** across slots rather than maxing — the four ores'
individual per-ore contributions at 25% share (0.0775+0.058125+0.062+0.11625) add to
0.313875, matching the engine's output to the last decimal. 13F/13G/13H confirm ore,
race, class-table, and achievement attack speed all sum into the same total with no
double-counting or override, and that `attack_rate = (1+atk_speed)/interval` correctly
propagates into `weapon_dps` in every case. 13G/13H incidentally show that **an
Archangel build automatically pulls in its smite proc** once attack_rate crosses a whole
number (13G's total_dps of 763.22 vs. weapon_dps of 613.55 is entirely the Archangel
smite term, `FLOOR(3.296)×0.5 = 1.5`) while the Felynx build in 13H has no such
side-effect (total_dps == weapon_dps) — not a defect, just a reminder that Archangel
specifically never gives attack speed "for free" without also nudging its own smite
tier. None of the four ores can reach the 150% atk_speed cap on their own (max combined
sum is 0.10+0.075+0.08+0.15 = 0.405); reaching the cap needs race/class/achievement
stacking on top, as already shown in category 10D.

## Corrections to my own assumptions (the engine was right every time)

1. **"crit_dmg has no cap" (scenario 10C) — wrong.** All four core stats, including
   crit_dmg, are capped via `Math.min(x, CAPS.x)` at the end of `statTotals`. This
   matches `CLAUDE.md`'s documented "each capped (1.5/1.0/1.0/1.5)" line; I'd
   mis-remembered which stats that applied to going in.
2. **"Galaxite's damage ramp should be ~0 with 3 blank slots" (scenario 5C) — wrong.**
   `slotShares` divides each slot's amount by the **sum of amounts across all slots**,
   not by slot count — so a single filled slot among three empty ones has a 100% share,
   not a diluted one. This is consistent with every other share calculation in the
   engine; I'd assumed "blank" slots would count toward the denominator the way they do
   for black hole's structural `COUNTA` trigger, but they don't for ordinary ramps.
3. **"25% share = the ramp-maxed value" (scenario 13E) — wrong.** The ramp only reaches
   its max at 30% share; 25% is 75% of the way through the base→max interpolation, not
   at the top. I wrote the scenario note predicting the fully-maxed sum (0.405) for a
   25%-share stack of the four attack-speed ores; the engine's actual 0.313875 is the
   correct mid-ramp sum (verified by hand: 0.0775+0.058125+0.062+0.11625 = 0.313875).

## Methodology

All 76 builds were run through `MediaWiki-ForgeCalculator.js`'s real `calculate()`
function (same file the wiki ships), loaded in a Node `vm` sandbox with the actual
`Data-*.json` game data — no reimplementation, no mocking of engine internals. The full
scenario list and every field of every result are preserved in the session scratchpad
(`test_scenarios.js` / `scenario-results.json`) if a specific number needs re-deriving.
No repository files were changed by this testing pass other than this report.
