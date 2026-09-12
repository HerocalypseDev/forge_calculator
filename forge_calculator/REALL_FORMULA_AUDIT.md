# MediaWiki Engine vs `reference/reall.xlsx` — Formula Audit

**Target:** `Web/mediawiki/MediaWiki-ForgeCalculator.js` (+ its `Data-*.json`)
**Baseline:** `reference/reall.xlsx`, sheet `DPS Calculator`
**Date:** 2026-09-12

> ## STATUS: RESOLVED
>
> Everything below has been fixed across all three engines. All three now replay the
> workbook's own saved build at 37/37 cells. See the "reall.xlsx Realignment" entry in
> `CLAUDE.md` for the commit-by-commit breakdown and the verification commands.
>
> The four §3 questions were answered by the maintainer and are recorded as
> **approved deviations** in `CLAUDE.md`: ore attack speed is kept (sourced from
> `new.xlsx` C48), Minotaur reaches Berserk DPS via `E54`, Max Burst scales its
> lightning term, and `C64` keeps reading Fire's own `E34` (the sheet's `C37`
> reference is treated as a typo, still unfixed **in the sheet**).
>
> ### Correction to §2.8
>
> The Gauntlet finding below is **wrong as written**, and the real situation is the
> reverse. `C23`'s dropdown only offers the **plural** `"Gauntlets"`, so in the sheet
> it is `E45`'s singular lethality test that can never fire, while `E48`'s plural
> attack-speed test fires normally. The web calculators derive this from the weapon's
> `type`, which is the **singular** `"Gauntlet"` — matching neither lookup key — so
> Felynx was losing the attack-speed bonus the sheet does grant, and the MediaWiki
> `CLASS_LETHALITY` plural key would have granted a bonus the sheet never does.
> Resolved by registering both spellings in both tables, so Felynx + a Gauntlet weapon
> gets both bonuses (a deliberate deviation, approved).
>
> Two further bugs were found while fixing these, neither in the original list:
> the standalone `avgOrePower` fallback summed slot *objects* instead of their powers,
> and the standalone engine never returned its `lightning_*` result fields.

Method: every formula was read out of the workbook with openpyxl (no reliance on the
older `all_formulas*.txt` dumps, which predate this workbook), then the engine was run
against the workbook's **own saved default build** and diffed cell-by-cell against the
workbook's cached values. Aggregate cells (C97/C98/C101) that are defined purely in
terms of other cells were additionally verified by transcribing the workbook formula
literally over the engine's own component values, so those findings hold independently
of the ore data.

Harnesses added by this audit:

```bash
node Web/mediawiki/reall-golden.js        # 37 cells vs workbook cached values
node Web/mediawiki/reall-aggregates.js    # C97/C98/C101/C59/C73 formula transcription
python scripts/audit_reall.py reference/reall.xlsx Web/mediawiki/Data-Ores.json
```

`FC_ORES=<path>` on either JS harness swaps in a different ore catalog, which is how
data drift was separated from formula bugs below.

## Headline

Default build, shipped data: **27 of 37 cells diverge.** Total DPS 4631 vs 9790 — the
engine reports **47% of the workbook's DPS**.

Regenerating the ore catalog from the workbook drops that to **10 of 37**. So the
damage splits cleanly:

| Class | Cells wrong | Fix |
|---|---|---|
| Stale `Data-*.json` | 17 of 27 | Rebuild data from `reall.xlsx` |
| Genuine formula bugs in the JS | 10 of 27 | Code changes, listed below |

---

## Part 1 — Data drift (`Data-Ores.json`, `Data-Weapons.json`)

### 1.1 Ore multipliers — 7 wrong

These feed `E10` (average ore power) → `A18`/`C18` (weapon damage) → **every** DPS
number, so they dominate the error.

| Ore | Workbook | Shipped JSON |
|---|---|---|
| Aether Lotus | 18.0 | 8.5 |
| Fichilliumorite | 1.0 | 22.0 |
| Fierce Jade | 17.0 | 9.0 |
| Kitsunite | 27.5 | 12.0 |
| Vanegos | 19.5 | 10.0 |
| Vooite | 21.0 | 15.0 |
| Zephyte | 18.5 | 7.0 |

Default build: `E10` = 23.6 (workbook) vs 15.0 (engine). All 7 are ores added in
`e512c81`. Ore *count* is fine (147 both sides).

### 1.2 Weapon stats — 1 wrong

| Weapon | Workbook (interval, damage) | Shipped JSON |
|---|---|---|
| Tanto | 0.39, 4.95 | 0.47, 4.73 |

### 1.3 Ore stat ranges — 30 problems

Full list from `scripts/audit_reall.py`. The significant ones:

**Kitsunite is wrong in nine ways** — four ranges understated 7×, five stats missing
outright:

| Stat | Workbook | Shipped JSON |
|---|---|---|
| explosion_dmg | 7 → 70 | 1 → 10 |
| fire_dmg | 4 → 40 | 1 → 10 |
| lightning_dmg | 8 → 80 | 1 → 10 |
| smite_dmg | 2.5 → 50 | 1 → 10 |
| explosion_chance | 4 → 40 | *missing* |
| fire_chance | 5 → 50 | *missing* |
| fire_duration | 0.5 → 5 | *missing* |
| smite_chance | 5 → 50 | *missing* |
| lightning_chance | 6 → 60 | *missing* |

Kitsunite's smite also has a clamp no other ore has:
`MAX(0.05, MIN(0.5, ramp))` — floor 5%, ceiling 50%, **and no 10%-share gate**, so it
pays out even below the normal threshold. Not implemented anywhere in the engine.

**Fierce Jade is entirely wrong** — and it sits in the workbook's own default build:

| Stat | Workbook | Shipped JSON |
|---|---|---|
| lethality | 2 → 20 | *missing* |
| crit_chance | 3.5 → 35 | *missing* |
| crit_dmg | 2 → 20 | *missing* |
| lightning_dmg | — | 3 → 30 *(invented)* |
| lightning_chance | — | 1.5 → 15 *(invented)* |

**Also missing:** Vanegos `lethality` 4 → 40, Tiger's Eye `lethality` 0.5 → 5.

**Stats in the JSON that the workbook never computes:**

- `lightning_dmg` / `lightning_chance` on Aether Lotus, Fierce Jade, Vanegos, Vooite,
  Zephyte — `C80`/`C81` only reference **Kitsunite and Marblite**.
- `blackhole_dmg` 30 → 300 on Fichilliumorite — `C76` only references **Galaxite**.
- `atk_speed` on Tiger's Eye, Wolfarite, Yeti Heart — see §3c; `C48` has no ore formula
  at all now. Live effect: Wolfarite at 100% share gives the engine `atk_speed` 0.08
  where the workbook gives 0.

Marblite's lightning ranges and Galaxite/Malachite/Heavenite are correct.

---

## Part 2 — Formula bugs in the JS (survive a data rebuild)

With a workbook-correct ore catalog, these 10 cells still diverge, tracing to 9 bugs.

### 2.1 Archangel smite damage — `C72`, line 556

```
workbook:  + IF(C22="Archangel", MIN(FLOOR(E21,1)*0.5, 1.5), 0)
engine:    smite_dmg_bonus = (1.5 + atkSpeedTotal * 1.5)
```

The workbook grants **+50% per whole attack/sec, capped at 150%** (a step function on
`FLOOR`). The engine invents a linear function of the attack-speed *bonus*. Default
build: workbook 1.5, engine 2.6.

### 2.2 Smite chance — race must be **added**, not maxed — `C73`, line 575

```
workbook:  MAX(slot1..slot4) + IFS(C22="Angel",0.5, C22="Archangel",0.33, TRUE,0)
engine:    Math.max(slotMax(...), RACE_SMITE_CHANCE[race])
```

Ores max against each other, then the race bonus is **added on top**. Heavenite at 30%
share + Archangel: workbook 0.73, engine 0.40. Default build: 0.83 vs 0.33.

### 2.3 Black hole DPS — rate term is inverted — `E77`, line 662

```
workbook:  = E13 * C77 * C76 * MAX(1, E21)      <- floor of 1
engine:    unforged * dmg * chance * Math.min(atkRate, 1)   <- ceiling of 1
```

`MAX` vs `MIN` — exactly backwards. Default build: 188.71 vs 70.09. This is also the
one failure in the existing `verify-engine.js`.

### 2.4 Explosion proc chance is additive, not max — `C59`, line 564

```
workbook:  = SUM(IFS(slot1), IFS(slot2), IFS(slot3), IFS(slot4), D37)
engine:    Math.max(slotMax(...), abilities.blast_chance)
```

`SUM(a,b,c,d,D37)` sums all four slots **and** the Blast ability chance — the same
additive shape as `C58` (explosion DMG), which the engine *does* sum. Magmaite +
Meteorite both at 50% share: workbook 0.45, engine 0.25.

Worth stressing: fire (`C63`) and poison (`C68`) chance genuinely **do** use `MAX(...)`.
Explosion is the exception, so the engine's uniform "chance = max of slots" rule is
wrong in exactly one place. The default build has only one explosion ore, which is why
this hid behind a passing cell.

### 2.5 Berserk DPS double-counts — `C97`, lines 667–673

```
workbook:  = ((E19 * (1 + C54)) * E21) + SUM(C90:C94) + E94
           i.e.  C89 * (1 + C54) + all six proc DPS
engine:    lethBoosted = min(lethality + berserkLevel, 1.5)
           berserk = procs + forged*(1+lethBoosted)*blend*atkRate * (1 + berserkLevel)
```

Three problems: berserk is applied **twice** (folded into lethality *and* as an outer
multiplier); `berserkLevel` also pulls in ore `phys_dmg` and the Minotaur race bonus,
where `C97` uses the bare `C54` input; and the lethality cap is applied to a value the
workbook never caps. `C54` = 30%: workbook 12064, engine 13444.

This is the worst offender in the existing fuzz harness — `berserk` differs on **all
250** builds.

### 2.6 Moon Stone DPS drops every proc — `C98`, line 675

```
workbook:  = IF(C53=0, C96, (C89 * (1 + C53)) + C90+C91+C92+C93+C94+E94)
engine:    moonstone = weapon_dps * (1 + moon)
```

The workbook boosts the physical hit and then **adds all six proc components back**.
The engine returns only the boosted physical hit, so Moon Stone DPS reads *below* total
DPS whenever any proc is active. Moon Stone build: workbook 7536, engine 6006.

### 2.7 Max Burst lightning term — `C101`, line 684

```
workbook:  ... + C76*C18 + C80          <- bare C80, unscaled
engine:    ... + forged * lightning_dmg * lightning_chance * atkRate
```

The workbook's final term is the raw lightning DMG **percentage** (0.8), not damage.
The engine contributes ~754 where the workbook contributes 0.8. This looks like an
authoring slip in the sheet — but under "zero invented mechanics" it is the spec, so
flagging rather than guessing (see §3d).

### 2.8 Felynx lethality never fires — `E45`, line 33

```
workbook E45:  AND(C22="Felynx", C23="Gauntlet")    <- SINGULAR
engine:        CLASS_LETHALITY = { 'Felynx,Gauntlets': 0.20 }   <- PLURAL
```

`Gauntlet` (singular) **is** a real weapon type — Ironhand, Boxing Glove, Relevator,
Savage Claws — so this bonus is reachable and currently lost. Felynx + Ironhand:
workbook 0.20 lethality, engine 0.

`engine.py:64` has it right (`("Felynx", "Gauntlet")`), so this is a MediaWiki-port
regression. The plural genuinely belongs on atk-speed (`E48`, where it stays
unreachable, as CLAUDE.md notes) — the port swapped the two.

### 2.9 Lightning ability inputs are entirely unwired — `C36`/`D36`/`E36`

The workbook has a full Lightning ability row feeding three cells:

| Workbook | Consumer |
|---|---|
| `C36` Lightning DMG | `C80` ends `... + C36` |
| `D36` Lightning Chance | `C81` = `MAX(slot1..slot4, D36)` |
| `E36` Lightning Cooldown | `E80` = `MIN(slots..., IF(E36=0,99,E36))` |

In the MediaWiki version none of it exists:

- `ABILITY_RANGES` (line 1514) and `createAbilityGrid` (line 1587) cover **Fire,
  Poison, Blast only** — there is no Lightning input in the UI.
- `normalizeBuild` (line 624) carries only `lightning_chance`; no `lightning_dmg`, no
  `lightning_cooldown`.
- `procComponents` (lines 578–580) never adds `abilities.lightning_dmg`, and
  `lightning_cooldown` is `slotMin` over ores only — the `IF(E36=0,99,E36)` ability term
  and the `=99 → 0` sentinel are both absent.
- `transformBuildForEngine` (line 2383) passes no lightning fields.

So a rune Lightning ability contributes **nothing**. Note `4a3f4e3` ("Add Lightning
ability inputs") only touched `Web/js/` — it never reached this file.

---

## Part 3 — Workbook questions (need your call, not code bugs)

These are places where `reall.xlsx` itself looks off. Under "zero invented mechanics" I
won't guess, so please confirm which behaviour you want.

### 3a. `C64` fire duration reads `C37` (Blast DMG), not `E34` (Fire Time)

The fire-duration chain ends:

```
MAX( <4 ore slot terms>, IF(C22="Dragonborn",3,0), C37 )
```

`C37` is the **Blast** row's DMG cell. Fire's own Time cell is `E34`, and it is
referenced nowhere. Every other ability wires to its own row correctly (`C58`→`C37`,
`C59`→`D37`, `C62`→`C34`, `C63`→`D34`, `C67`→`C35`, `C68`→`D35`, `C69`→`E35`,
`C80`→`C36`, `C81`→`D36`, `E80`→`E36`) — fire duration is the only outlier, which reads
like a stale reference left behind when the ability grid was transposed from columns to
rows.

As the sheet stands: typing a Fire **duration** does nothing, and typing a Blast
**damage** extends the burn. The engine uses `abilities.fire_time` (the `E34` reading).
**Should `C64` point at `E34`?**

### 3b. Minotaur no longer reaches berserk DPS

`E54 = C54 + IF(C22="Minotaur",30%)`, but `C97` uses the bare **`C54`**. So Minotaur's
+30% now only appears in the `E54` display cell and never affects Berserk DPS.
`engine.py:507` uses the old `E54` semantics. **Intentional?**

### 3c. Ore attack speed has disappeared

`C48` is now a bare `0.0` input with no ore formula and no "Auto-calculated from ores"
note (unlike `C42`–`C44`). Tiger's Eye, Wolfarite and Yeti Heart therefore contribute no
attack speed at all. The MediaWiki UI has no attack-speed field either, so that stat is
currently unreachable from the calculator. **Did you mean to drop the ore formula, and
should the UI gain an Atk Speed input like the armor ones?**

### 3d. Bare `+C80` in `C101`

See §2.7 — almost certainly meant to be `C18*C80*C81*E21` or similar. **Confirm.**

---

## Part 4 — Repo state

Both existing harnesses were **already failing on `main`** before this audit, in exactly
the areas above:

```
node Web/mediawiki/verify-engine.js  -> 1 FAIL
    galaxite blackhole_dps: expected 41.17, got 19.35      (= bug 2.3)

node Web/mediawiki/fuzz_verify.js    -> 974 MISMATCHES / 250 builds
    berserk        250   (= bug 2.5)
    active_traits   83
    ttk_75k/25k    132
    total_dps       66
    max_dps         64   (= bug 2.7)
    weapon_dps      57
    explosion_dps   55   (= bug 2.4)
    smite_dmg/dps   26   (= bugs 2.1, 2.2)
    ...
```

`4a3f4e3` changed the JS engines without re-syncing `engine.py` or the goldens, so the
Python reference is now stale too — the fuzz differential is comparing two different
wrong answers.

### Docs that need updating

`CLAUDE.md` still describes the previous workbook:

- "Zero invented mechanics" names `new.xlsx` (now `reall.xlsx`).
- The quirks list documents the **old transposed ability grid** ("Fire DMG=C34 /
  Chance=C35 / Time=C36, Poison=D34/D35/D36, Blast=E34/E35"). `reall.xlsx` is
  row-per-ability: Fire 34, Poison 35, **Lightning 36**, Blast 37, with DMG/Chance/Time
  in columns C/D/E.
- Row numbers throughout are off by the new layout (armor is `C42`–`C44` not
  `C41`–`C43`; stats `E45`–`E48` not `E44`–`E47`; black hole chance `C77` not `C76`;
  poison duration `C69` not `C68`; DPS block `C89`–`C101`).
- The Gauntlet quirk note should call out that **singular is the reachable one**
  (lethality), plural is the dead one (atk speed).

---

## Suggested order of work

1. **Rebuild the data** from `reall.xlsx` (`scripts/build_data.py`) — clears 17 of 27
   failing cells on its own, and is a prerequisite for trusting any formula test.
   Watch for the stats the workbook *doesn't* define (§1.3 "invented") so the rebuild
   removes them rather than preserving them.
2. **Answer §3** — `C64`/`C101` in particular change what "correct" means.
3. **Fix the 9 formula bugs** (§2). 2.1–2.4 and 2.8 are one-liners; 2.5–2.6 are small
   rewrites; 2.9 needs new UI fields.
4. **Re-sync `engine.py` + goldens**, then re-run `reall-golden.js`,
   `reall-aggregates.js`, `verify-engine.js`, `fuzz_verify.js`.
5. **Update `CLAUDE.md`.**
