"""
extract_champions_weekly_2025.py
---------------------------------
Reads the WEEKLY MCA sheet from Champions Network Weekly Report 2025.xlsx.
The sheet contains multiple sections:
  - "Champions 4 Week PGA Average 2025"  (Jan 26–Feb 16, 2025)  → PGA data
  - "Champions MCA April 2025"           (Apr 6–Apr 27, 2025)   → MCA data
  - "Champions MCA May 2025"             (May 7–May 28, 2025)   → MCA data
  - "Champions MCA July 2025"            (Jul 2–Jul 27, 2025)   → MCA data

All codes in this file are current 6-char codes — no mapping needed.

Outputs:
  data/outputs/champions_weekly_2025_pga.json   — PGA records
  data/outputs/champions_weekly_2025_mca.json   — MCA records
  Each: { locationCode, weekDate, value }

Run:
  python3 data/scripts/extract_champions_weekly_2025.py
"""

import json
import os
from datetime import datetime

import openpyxl

EXCEL_FILE = os.path.join(
    os.path.dirname(__file__),
    "../Champions Data/Champions Network Weekly Report 2025.xlsx",
)
PGA_OUT = os.path.join(os.path.dirname(__file__), "../outputs/champions_weekly_2025_pga.json")
MCA_OUT = os.path.join(os.path.dirname(__file__), "../outputs/champions_weekly_2025_mca.json")


def to_int(val):
    if val is None:
        return None
    if isinstance(val, str):
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def main():
    wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    ws = wb["WEEKLY MCA"]
    rows = list(ws.iter_rows(values_only=True))

    pga_records: dict[tuple, dict] = {}
    mca_records: dict[tuple, dict] = {}

    i = 0
    while i < len(rows):
        row = rows[i]

        # Detect a section title row: string in col A or B containing keywords
        title = None
        for col in (0, 1):
            if isinstance(row[col], str) and any(
                kw in row[col].upper() for kw in ("CHAMPIONS", "MCA", "PGA")
            ):
                title = row[col].upper()
                break

        if title is not None and i + 1 < len(rows):
            # Peek at next row to see if it's the header (has datetime columns)
            header_row = rows[i + 1]
            date_cols = {
                j: header_row[j].strftime("%Y-%m-%d")
                for j in range(2, min(8, len(header_row)))
                if isinstance(header_row[j], datetime)
            }

            if date_cols:
                is_pga = "PGA" in title
                i += 2  # skip title + header

                while i < len(rows):
                    data_row = rows[i]
                    code = data_row[1] if len(data_row) > 1 else None
                    if isinstance(code, str):
                        code = code.strip()

                    # Stop at totals row or a new section
                    if not isinstance(code, str) or not code.startswith("WH"):
                        # Check for another section coming
                        if any(
                            c < len(data_row)
                            and isinstance(data_row[c], str)
                            and any(kw in data_row[c].upper() for kw in ("CHAMPIONS", "MCA", "PGA"))
                            for c in (0, 1)
                        ):
                            break  # start of next section, don't advance i
                        i += 1
                        continue

                    for col_idx, date_str in date_cols.items():
                        val = to_int(data_row[col_idx] if col_idx < len(data_row) else None)
                        if val is not None:
                            key = (code, date_str)
                            record = {"locationCode": code, "weekDate": date_str, "value": val}
                            if is_pga:
                                pga_records[key] = record
                            else:
                                mca_records[key] = record
                    i += 1
                continue  # already incremented

        i += 1

    def write_out(records, path, metric):
        items = sorted(records.values(), key=lambda r: (r["locationCode"], r["weekDate"]))
        codes = sorted(set(r["locationCode"] for r in items))
        dates = sorted(set(r["weekDate"] for r in items))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(
                {
                    "metric": metric,
                    "recordCount": len(items),
                    "locationCount": len(codes),
                    "weekCount": len(dates),
                    "dateRange": f"{dates[0]} – {dates[-1]}" if dates else "",
                    "locationCodes": codes,
                    "records": items,
                },
                f,
                indent=2,
            )
        print(
            f"✅ {metric}: {len(items)} records | {len(codes)} locations | {len(dates)} weeks"
            + (f" | {dates[0]} – {dates[-1]}" if dates else "")
        )

    write_out(pga_records, PGA_OUT, "PGA")
    write_out(mca_records, MCA_OUT, "MCA")


if __name__ == "__main__":
    main()
