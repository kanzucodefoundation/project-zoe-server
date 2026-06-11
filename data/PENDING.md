# Deferred Import Work

Items here were inspected but not imported. Each entry explains what was found,
why it was deferred, and what would be needed to pick it up.

---

## DIA sheets — Champions Network Weekly Report 2025.xlsx

**Sheets:** `DIA 1`, `DIA 2025`, `DIA in Clusters`
**Source file:** `data/Champions Data/Champions Network Weekly Report 2025.xlsx`
**Status:** Inspected, not imported — would require a new report type.

**What they contain:**
Discipleship Impact Assessment data. Tracks disciple-making metrics across
Champions Network locations and clusters. Distinct from MCA/PGA attendance
and from the existing categorization grades.

**What would be needed to import:**
1. Inspect all three sheets in detail to confirm field names and structure.
2. Decide whether DIA maps to an existing report or needs a new `Report` entity
   seeded in `seed-whm-reports.ts` (likely the latter — no current report has a
   `functionName` for DIA).
3. Write extraction script (`data/scripts/extract_champions_dia_2025.py`).
4. Write import command (`src/commands/import-champions-dia-2025.ts`) and add
   an `npm run import:champions:dia:2025` script to `package.json`.

---

## Unresolved location codes — Champions Oikos 2022

**File:** `data/outputs/champions_oikos_2022_unresolved.json`
**Codes:** `WHKIT` (13 weeks, Oct 2022–Feb 2023), `WHNLG` (6 weeks, Jan–Feb 2023)

See the unresolved file for full records and per-code resolution instructions.
Short version: confirm the current 6-char code with network leadership, add one
line to `CODE_MAP` in `data/scripts/extract_champions_oikos_2022.py`, then
re-run extraction + `npm run import:champions:oikos2022`.

The same codes appear in `data/outputs/champions_unresolved_codes.json` (PGA).
If resolved, update `CODE_MAP` in both extraction scripts.

**New supporting evidence (2026-06-10):** `WHKITI` ("WH Kiti") is a seeded,
active location with March 2026 categorization data (rank 71, pga 79, mca
97.6, mcs 18). This makes `WHKIT` → `WHKITI` the leading candidate, but the
group name is "WH Kiti" not "WH Kito" as originally guessed in the unresolved
file's note — still recommend confirming with network leadership before adding
to `CODE_MAP`, since "Kiti" and "Kito" could be different places.

---

## Historical WHM-wide categorization — remaining gaps

**Source file:** `data/WHM Data/WHM March 2026 Categorization.xlsx`
**Status:** 17 months imported via `npm run import:whm:categorization`
(2959 records, 241 location codes, 0 unmatched, Aug 2024 - Mar 2026 excluding
Sep 2024). See `extract_whm_categorization.py`'s docstring for the full
sheet-to-period mapping and the reasons each excluded sheet was excluded.

Both `import:whm:categorization` and `import:champions:categorization:2025`
are idempotent on `(group, reportingPeriod)` existence for this report — safe
to re-run after adding more sheets.

**Still not imported (each needs a decision/fix before it can be added):**

| Period | Candidate sheet(s) | Issue |
|---|---|---|
| 2024-05 | `May 2024 Categorization` (122 locs) | Non-standard column layout — location/grade/pga/mca/mcs/plants/fts columns are shifted (location=2, grade=18, pga=20, mca=21, mcs=22, plants=24, fts=26) and no `opsInc` column was found. Needs a sheet-specific `col_map` override. |
| 2024-07 | `Q3 Categorization` (141 locs) vs `Jul-Nov 2024 Average Categoriza` (141 locs) | `Q3 Categorization` has two side-by-side month titles (July left, August right) and `find_header()` mis-detects "grade" at column 33 from the August side-table. The "Average" sheet is a multi-month average, not a snapshot. Needs a sheet-specific `col_map` override for `Q3 Categorization`, or confirmation that 2024-07 should remain unimported. |
| 2024-09 | `September 2024 Categorization` (141 locs) vs `Peculiar September 2024 Categor` (124 locs) | Conflicting values for 123 shared location codes — needs network leadership to confirm which is authoritative. |

**What's left after these:** only **April 2026** and **May 2026**
categorization remain entirely PDF-only (`data/More Data/WHM April 2026
Categorization.pdf`, `data/WHM Data/WHM April 2026 Categorization.pdf`,
`data/WHM Data/WHM May 2026 Categorization.pdf`).

**To add any of the above:** write the sheet-specific `col_map` override (or
resolve the 2024-09 conflict), add the sheet to `SHEETS` in
`extract_whm_categorization.py`, re-run extraction, then re-run `npm run
import:whm:categorization`.

---

## Unresolved location names — Weekly Salvations 2023 & 2024

**Files:** `data/outputs/champions_salvations_weekly_2023_unresolved.json`,
`data/outputs/champions_salvations_weekly_2024_unresolved.json`
**Status:** 13 unresolved name entries in each file (26 total), representing 7
underlying locations that appear under both a plain name and a `WH`-prefixed
variant (e.g. `Bukaya` / `WHBukaya`):

| Location pair | 2023 weeks | 2024 weeks | Combined |
|---|---|---|---|
| Newcastle / WHNewcastle | 28 + 9 | 13 + 4 | 54 |
| Kamwokya / WHKamwokya | 27 + 9 | 13 + 4 | 53 |
| Bukaya / WHBukaya | 16 + 2 | 10 + 1 | 29 |
| Kafunta / WHKafunta | 11 + 7 | 3 + 3 | 24 |
| Nateete / WHNateete | 3 + 1 | 10 + 1 | 15 |
| Mawangala / WHMawangala | 4 + 4 | 3 + 3 | 14 |
| BAITA | 1 | 1 | 2 |

**Quick win — Mawangala / WHMawangala (14 weeks):** WHMWGL (WH Mawangala) is
now seeded (see Step 6 history). These name-based entries likely also belong
to WHMWGL — add `"mawangala" → "WHMWGL"` to `NAME_TO_CODE` in
`extract_champions_salvations_weekly.py`, re-extract both years, re-run
`import:champions:salvations:2023` / `:2024`.

**The rest (Newcastle, Kamwokya, Bukaya, Kafunta, Nateete, BAITA — 177 weeks
combined):** not obviously mappable to any seeded location code. Need to
confirm with network leadership whether these are existing locations under a
different code, or new locations that need seeding in
`whm-group-tree.seed.ts` (same pattern as WHMWGL). Once resolved, add to
`NAME_TO_CODE`, re-extract, re-run the weekly importers (idempotent).

---

## Unresolved location codes — Annual Salvations & Baptisms 2023

**File:** `data/outputs/champions_salvations_annual_unresolved.json`
**Codes (4):**

| Code | Salvations | Baptisms |
|---|---|---|
| WHBLB | 140 | 10 |
| WHBMB | 132 | 0 |
| WHKRO | 55 | 0 |
| WHNFM | 111 | 18 |

These are 5-char codes that don't match any current 6-char `WH****` location
code. Confirm the correct code with network leadership, add to `CODE_MAP` in
`data/scripts/extract_champions_salvations_annual.py`, re-extract, re-run
`npm run import:champions:salvations:annual` (idempotent).

---

## Step 7 — WHKTKT member contacts → Contact + GroupMembership

**Status:** Blocked, not yet scoped.

**What's needed before this can start:**
1. Source file — has not been identified/located yet.
2. Field mapping — which columns map to `Contact` fields vs `GroupMembership`.
3. Group assignment — how each contact maps to an MC (fellowship group) under
   WHKTKT's zone/MC tree.
4. Dedup strategy — how to match against any contacts already in the DB
   (by phone, name, or other key) to avoid duplicates on re-run.

No extraction or import script exists yet for this step.
