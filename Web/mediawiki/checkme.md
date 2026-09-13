# Your build: spreadsheet vs MediaWiki JS

**Build:** Hook Blade (Straight Sword) · Kitsunite ×20 · Fichilliumorite ×15 · Galaxite ×15 · Archangel · Attack Speed +20% achievement

**Physical hit DPS is identical in the spreadsheet and the JS, to 6 decimal places.** Everything that feeds it matches too, as do every proc and Total DPS. The only difference found is Max Burst, which is a signed-off change and isn't shown in the calculator.

**How it was checked:** no Excel engine is installed, so a small evaluator was written that runs the formulas in `reference/reall.xlsx`. It was first run on the build already saved in the sheet and reproduced all 38 values Excel had stored. Then your build was entered, and the same build was run through the MediaWiki calculator's own code (`MediaWiki-ForgeCalculator.js`), including its input-conversion step (`transformBuildForEngine`).

Enhancement, quality and armor weren't in the build list, so two versions were run:
- **A:** those inputs as saved in the sheet (Quality 100, Enhancement +9, armor lethality/crit chance/crit dmg 80/70/40).
- **B:** the MediaWiki calculator's defaults (Quality 100, +0, armor all 0).

## Physical hit DPS breakdown (C89)

`C89 = C18 × (1 + E45) × crit blend × E21`

| Cell | Stat | A: Sheet | A: JS | B: Sheet | B: JS |
|---|---|---|---|---|---|
| E10 | Avg ore multiplier | 26.4286 | 26.4286 | 26.4286 | 26.4286 |
| C18 | Weapon damage (with enhancement) | 654.107 | 654.107 | 436.071 | 436.071 |
| E45 | Lethality | 100% | 100% | 20% | 20% |
| E46 | Crit chance | 100% (capped) | 100% | 45% | 45% |
| E47 | Crit dmg bonus | 60% | 60% | 20% | 20% |
| – | Crit blend | 2.0500 | 2.0500 | 1.2925 | 1.2925 |
| E48 | Attack speed bonus | 40% | 40% | 40% | 40% |
| E21 | Hits/sec | 2.6923 | 2.6923 | 2.6923 | 2.6923 |
| **C89** | **Physical hit DPS** | **7,220.34** | **7,220.34** | **1,820.93** | **1,820.93** |
| C96 | Total DPS | 9,466.27 | 9,466.27 | 4,066.87 | 4,066.87 |

## Where each number comes from

- **Fichilliumorite:** it's left out of the average multiplier in both, giving (20×27.5 + 15×25) / 35 = 26.43. It still counts toward the ore total, so Kitsunite is 40% of the ores and Galaxite 30%. The sheet and the JS both do this.
- **Weapon type Straight Sword:** no effect for an Archangel. The only Straight Sword bonus is Vampire's +10% lethality. The JS correctly picks up the type from Hook Blade.
- **Attack speed 40%:** Archangel 20% + achievement 20%. Neither Kitsunite, Galaxite nor Fichilliumorite has an attack-speed stat, so the one formula difference that affects attack speed (the JS keeps ore attack speed from the older workbook, `new.xlsx`) doesn't apply to this build.
- **Crit chance (version A):** Galaxite gives 45% and armor gives 70%, which is 115%, but it's capped at 100%. The extra 15 points from armor do nothing.

## The one difference: Max Burst (C101)

| | Sheet | JS | Difference |
|---|---|---|---|
| A | 10,089.14 | 10,933.65 | +844.51 |
| B | 4,237.40 | 4,800.14 | +562.74 |

This is signed-off change #3 in `CLAUDE.md`. The sheet's C101 ends with `+C80`, which adds the raw lightning percentage (0.8). The JS uses `C18×C80×C81×E21` instead, like every other proc. The gap is exactly that term minus 0.8. The calculator no longer displays Max Burst, and it doesn't affect physical hit DPS.

## If your numbers don't match

If the sheet and the wiki show different physical hit DPS for this build, the cause is almost certainly the inputs not in the list, not the formulas. The sheet has +9 enhancement and 80/70/40 armor saved, while the wiki starts at +0 and 0 armor. That alone makes version A about 3.97× version B:
- 1.5× from enhancement
- 2.0 / 1.2 from lethality
- 2.05 / 1.2925 from the crit blend

Enter the same enhancement and armor in both and they agree.
