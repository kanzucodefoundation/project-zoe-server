"""
extract_champions_categorization_2025.py
------------------------------------------
Reads the 4 categorization sheets from Champions Network Weekly Report 2025.xlsx:
  Categorization          → CHAMPIONS JULY 2025      (2025-07)
  August Categorization   → CHAMPIONS AUGUST 2025    (2025-08)
  sept Categorization     → CHAMPIONS SEPTEMBER 2025 (2025-09)
  October Categorization  → CHAMPIONS OCTOBER 2025   (2025-10)

Each sheet has: No. (rank), Cat. (grade A-G), Location, PGA, MCA, MCs,
Dscps (skipped), Plants, Ops Inc, FTS.

Output:
  data/outputs/champions_categorization_2025.json
    Array of { locationCode, reportingPeriod, rank, grade, pga, mca, mcs,
               plants, opsInc, fts }

Run:
  python3 data/scripts/extract_champions_categorization_2025.py
"""

import json
import os
import re

import openpyxl

EXCEL_FILE = os.path.join(
    os.path.dirname(__file__),
    "../Champions Data/Champions Network Weekly Report 2025.xlsx",
)
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "../outputs/champions_categorization_2025.json"
)

SHEETS = [
    "Categorization",
    "August Categorization ",
    "sept Categorization ",
    "October Categorization ",
]

MONTH_MAP = {
    "JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04",
    "MAY": "05", "JUNE": "06", "JULY": "07", "AUGUST": "08",
    "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12",
}


def parse_period(title: str):
    """Extract YYYY-MM from a title like 'CHAMPIONS JULY 2025 CATEGORIZATION'."""
    m = re.search(r"(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})", title.upper())
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
    for i, row in enumerate(rows):
        # Look for a row that has 'No', 'Cat', 'Location' somewhere
        row_strs = [str(v).strip().upper() if v is not None else "" for v in row]
        if any("NO" in s and len(s) <= 4 for s in row_strs) and any("CAT" in s for s in row_strs):
            col_map = {}
            for j, s in enumerate(row_strs):
                # Use first occurrence of each column name (row may have duplicate sections)
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

        # Find reporting period from title cell
        period = None
        for row in rows[:5]:
            for cell in row:
                if isinstance(cell, str) and "CATEGORIZATION" in cell.upper():
                    period = parse_period(cell)
                    break
            if period:
                break

        if not period:
            print(f"⚠️  Could not parse period from {sheet_name.strip()}, skipping")
            continue

        header_idx, col_map = find_header(rows)
        if header_idx is None:
            print(f"⚠️  No header row found in {sheet_name.strip()}, skipping")
            continue

        data_start = header_idx + 1
        count = 0
        for row in rows[data_start:]:
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

        print(f"✅ {sheet_name.strip()} ({period}): {count} locations")

    periods = sorted(set(r["reportingPeriod"] for r in all_records))
    codes = sorted(set(r["locationCode"] for r in all_records))

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(
            {
                "description": "Champions 2025 monthly categorization data",
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
