"""
extract_champions_salvations_2025.py
--------------------------------------
Reads the 'baptisms vs salvations' sheet from Champions Network Weekly Report
2025.xlsx. Data is a 2025 YTD snapshot of salvations and baptisms for the
global Champions network.

Skips rows with formula errors or zero for both fields.

Output:
  data/outputs/champions_salvations_2025.json
    { reportingPeriod, records: [{ locationCode, salvations, baptisms }] }

Run:
  python3 data/scripts/extract_champions_salvations_2025.py
"""

import json
import os

import openpyxl

EXCEL_FILE = os.path.join(
    os.path.dirname(__file__),
    "../Champions Data/Champions Network Weekly Report 2025.xlsx",
)
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "../outputs/champions_salvations_2025.json"
)

REPORTING_PERIOD = "2025-12-31"


def to_int(val):
    if val is None or isinstance(val, str):
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def main():
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    ws = wb["baptisms vs salvations"]
    rows = list(ws.iter_rows(values_only=True))

    records = []
    for row in rows[2:]:  # skip title (row 1) and header (row 2)
        code = row[1] if len(row) > 1 else None
        if not isinstance(code, str) or not code.strip().startswith("WH"):
            continue
        code = code.strip()
        if code.upper() == "TOTAL":
            continue

        salvations = to_int(row[3] if len(row) > 3 else None)
        baptisms = to_int(row[4] if len(row) > 4 else None)

        # Skip if both are zero or None (no data)
        if (salvations or 0) == 0 and (baptisms or 0) == 0:
            continue

        record = {"locationCode": code}
        if salvations is not None:
            record["salvations"] = salvations
        if baptisms is not None:
            record["baptisms"] = baptisms
        records.append(record)

    codes = sorted(set(r["locationCode"] for r in records))

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(
            {
                "description": "Champions global network 2025 annual salvations & baptisms",
                "reportingPeriod": REPORTING_PERIOD,
                "recordCount": len(records),
                "locationCodes": codes,
                "records": records,
            },
            f,
            indent=2,
        )

    print(f"✅ {len(records)} locations | reportingPeriod: {REPORTING_PERIOD}")
    print(f"   Codes: {', '.join(codes)}")


if __name__ == "__main__":
    main()
