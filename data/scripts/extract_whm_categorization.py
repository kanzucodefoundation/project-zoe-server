"""
extract_whm_categorization.py
--------------------------------
Reads comprehensive (network-wide) monthly categorization sheets from
WHM Data/WHM March 2026 Categorization.xlsx. Unlike the Champions Network
Weekly Report 2025.xlsx categorization sheets (16-18 "Champions" locations
per month), these sheets cover the full WHM network (~180-225 locations).

Sheets covered (all verified: 0 unmatched location codes against seeded
Group.metaData.code for tenant 'worshipharvest', and identical
rank/grade/location/pga/mca/mcs/plants/opsInc/fts column layout):
  August 2024 Categorization (1) -> 2024-08  (128 locations)
  October 2024 Categorization    -> 2024-10  (142 locations)
  November 2024 Categorization   -> 2024-11  (145 locations)
  January 2025 Categorization    -> 2025-01  (151 locations)
  February 2025 Categorization   -> 2025-02  (160 locations)
  March 2025 Categorization      -> 2025-03  (167 locations)
  April 2025 Categorization      -> 2025-04  (166 locations)
  May 2025 Cat.                  -> 2025-05  (168 locations)
  June 2025 Cat                  -> 2025-06  (173 locations)
  July 2025 Cat                  -> 2025-07  (174 locations)
  August 2025 Cat                -> 2025-08  (180 locations)
  September 2025                 -> 2025-09  (184 locations)
  October 2025                   -> 2025-10  (188 locations)
  November 2025                  -> 2025-11  (194 locations)
  January 2026                   -> 2026-01  (200 locations)
  NEW February 2026              -> 2026-02  (219 locations) -- supersedes "February 2026"
  March 2026                     -> 2026-03  (225 locations)

Deliberately excluded (see data/PENDING.md for details):
  - "August 2024 Categorization (2)" / "Copy of November 2024 Categoriz" —
    byte-identical duplicates of the (1)/non-Copy sheets above.
  - "September 2024 Categorization" / "Peculiar September 2024 Categor" —
    both parse to 2024-09 but have conflicting values for 123 shared
    locations; needs a human decision on which is authoritative.
  - "May 2024 Categorization" — non-standard column layout (location/grade/
    pga/mca/mcs shifted, no opsInc detected); needs manual column mapping.
  - "Q3 Categorization" (2024-07) — find_header() mis-detects "grade" at
    column 33 (bleeding in from an adjacent August side-table); needs a
    sheet-specific column override before it can be trusted.
  - "Jul-Nov 2024 Average Categoriza" / "July 2024 Categorization" — average
    across months / empty, not a single-period snapshot.

Each sheet has the same layout: title row 'WHM <MONTH> <YEAR> CATEGORIZATION',
header row with No. (rank), Cat. (grade A-G), Location, PGA, MCA, MCs,
Bptms/Dscps (skipped, not an importable field), Plants, Ops Inc, FTS,
followed by side-tables (duplicate Location/PGA/MCA/MCs/finance columns)
which are ignored via first-occurrence-wins column mapping.

Output:
  data/outputs/whm_categorization.json
    { recordCount, periodCount, locationCount, periods, locationCodes,
      records: [{ locationCode, reportingPeriod, rank, grade, pga, mca, mcs,
                   plants, opsInc, fts }] }

Run:
  python3 data/scripts/extract_whm_categorization.py
"""

import json
import os
import re

import openpyxl

EXCEL_FILE = os.path.join(
    os.path.dirname(__file__),
    "../WHM Data/WHM March 2026 Categorization.xlsx",
)
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "../outputs/whm_categorization.json"
)

SHEETS = [
    "August 2024 Categorization (1)",
    "October 2024 Categorization",
    "November 2024 Categorization",
    "January 2025 Categorization",
    "February 2025 Categorization",
    "March 2025 Categorization",
    "April 2025 Categorization",
    "May 2025 Cat.",
    "June 2025 Cat",
    "July 2025 Cat",
    "August 2025 Cat",
    "September 2025",
    "October 2025",
    "November 2025",
    "January 2026",
    "NEW February 2026",
    "March 2026",
]

MONTH_MAP = {
    "JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04",
    "MAY": "05", "JUNE": "06", "JULY": "07", "AUGUST": "08",
    "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12",
}


def parse_period(title: str):
    """Extract YYYY-MM from a title like 'WHM MARCH 2026 CATEGORIZATION'."""
    m = re.search(
        r"(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})",
        title.upper(),
    )
    if m:
        return f"{m.group(2)}-{MONTH_MAP[m.group(1)]}"
    return None


def to_float(val):
    if val is None:
        return None
    if isinstance(val, str):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def find_header(rows):
    """Return (row_index, col_map) where col_map maps field_name -> col_index."""
    for i, row in enumerate(rows[:6]):
        row_strs = [str(v).strip().upper() if v is not None else "" for v in row]
        if any("NO" in s and len(s) <= 4 for s in row_strs) and any("CAT" in s for s in row_strs):
            col_map = {}
            for j, s in enumerate(row_strs):
                # First occurrence of each column name wins (rows have duplicate side-tables)
                if s in ("NO.", "NO ") and "rank" not in col_map:
                    col_map["rank"] = j
                elif s == "CAT." and "grade" not in col_map:
                    col_map["grade"] = j
                elif s == "LOCATION" and "location" not in col_map:
                    col_map["location"] = j
                elif s == "PGA" and "pga" not in col_map:
                    col_map["pga"] = j
                elif s == "MCA" and "mca" not in col_map:
                    col_map["mca"] = j
                elif s == "MCS" and "mcs" not in col_map:
                    col_map["mcs"] = j
                elif s == "PLANTS" and "plants" not in col_map:
                    col_map["plants"] = j
                elif s == "OPS INC" and "opsInc" not in col_map:
                    col_map["opsInc"] = j
                elif s == "FTS" and "fts" not in col_map:
                    col_map["fts"] = j
            if "location" in col_map:
                return i, col_map
    return None, None


def main():
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    all_records = []

    for sheet_name in SHEETS:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))

        period = None
        for row in rows[:5]:
            for cell in row:
                if isinstance(cell, str) and "CATEGORIZATION" in cell.upper():
                    period = parse_period(cell)
                    break
            if period:
                break

        if not period:
            print(f"⚠️  Could not parse period from {sheet_name!r}, skipping")
            continue

        header_idx, col_map = find_header(rows)
        if header_idx is None:
            print(f"⚠️  No header row found in {sheet_name!r}, skipping")
            continue

        data_start = header_idx + 1
        count = 0
        for row in rows[data_start:]:
            # Some sheets stack a second month's table below a 'TOTAL' row
            # (e.g. July 2024 embedded under August 2024 Categorization (1)).
            # Stop at the first TOTAL row to avoid pulling in that second table.
            rank_idx, grade_idx = col_map.get("rank", 99), col_map.get("grade", 99)
            if (
                rank_idx < len(row) and row[rank_idx] is None
                and grade_idx < len(row) and isinstance(row[grade_idx], str)
                and row[grade_idx].strip().upper() == "TOTAL"
            ):
                break

            if "location" not in col_map or col_map["location"] >= len(row):
                continue
            code = row[col_map["location"]]
            if not isinstance(code, str):
                continue
            code = code.strip()
            if not code.startswith("WH"):
                continue

            record = {"locationCode": code, "reportingPeriod": period}

            rank_val = to_float(row[col_map["rank"]] if col_map.get("rank", 99) < len(row) else None)
            if rank_val is not None:
                record["rank"] = int(rank_val)

            grade_val = row[col_map["grade"]] if col_map.get("grade", 99) < len(row) else None
            if isinstance(grade_val, str) and grade_val.strip():
                record["grade"] = grade_val.strip()

            for field in ("pga", "mca", "mcs", "plants", "opsInc", "fts"):
                idx = col_map.get(field, 99)
                val = to_float(row[idx] if idx < len(row) else None)
                if val is not None:
                    record[field] = val

            all_records.append(record)
            count += 1

        print(f"✅ {sheet_name!r} ({period}): {count} locations")

    periods = sorted(set(r["reportingPeriod"] for r in all_records))
    codes = sorted(set(r["locationCode"] for r in all_records))

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(
            {
                "description": "WHM network-wide monthly categorization data (Aug 2024 - Mar 2026, excluding Sep 2024)",
                "recordCount": len(all_records),
                "periodCount": len(periods),
                "locationCount": len(codes),
                "periods": periods,
                "locationCodes": codes,
                "records": all_records,
            },
            f,
            indent=2,
        )

    print(f"\n✅ Total: {len(all_records)} records across {len(periods)} months | {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
