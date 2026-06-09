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
