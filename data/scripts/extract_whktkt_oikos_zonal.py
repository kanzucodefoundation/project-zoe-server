"""
extract_whktkt_oikos_zonal.py
--------------------------------
Reads WHKTKT zone-level Oikos metrics from two sources:

  1. data/WHM Data/outputs/whktkt_zonal_dashboard_data.json -> snapshotRecords
     (18 weeks, Jan 12 - May 31 2026, 11 zones; mcs/mca always present,
     mcm/salvations only for the last 2 weeks (May 24, May 31), visitations
     present Feb 22 - Apr 26)

  2. data/WHM Data/data/whktkt_oikos_zonal_updates.json
     (May 17 & May 24 2026; per-zone mcs/mca/mcm/salvations. May 24 values
     are identical to snapshotRecords - May 17 is the only new date here)

Zone names are normalised to match the seeded Zone group names:
  "Cathedral"    -> "Cathedral Zone"
  "Kijjabijo"    -> "Kijabijjo"
  "Namirembe Rd" -> "Namirembe rd"

Output:
  data/outputs/whktkt_oikos_zonal.json
    Array of { zone, weekDate, mcs, mcm, mca, salvations, visitations }
    (missing metrics are null)
    Ready to feed into import-whktkt-oikos-zonal.ts

Run:
  python3 data/scripts/extract_whktkt_oikos_zonal.py
"""

import json
import os

DASHBOARD_FILE = os.path.join(
    os.path.dirname(__file__),
    "../WHM Data/outputs/whktkt_zonal_dashboard_data.json",
)
UPDATES_FILE = os.path.join(
    os.path.dirname(__file__),
    "../WHM Data/data/whktkt_oikos_zonal_updates.json",
)
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../outputs/whktkt_oikos_zonal.json")

ZONE_NORMALIZE = {
    "Cathedral": "Cathedral Zone",
    "Kijjabijo": "Kijabijjo",
    "Namirembe Rd": "Namirembe rd",
}

FIELDS = ["mcs", "mcm", "mca", "salvations", "visitations"]


def to_int(val):
    if val is None:
        return None
    return int(round(val))


def main():
    records: dict[tuple[str, str], dict] = {}

    with open(DASHBOARD_FILE) as f:
        dash = json.load(f)

    for r in dash["snapshotRecords"]:
        zone = ZONE_NORMALIZE.get(r["zone"], r["zone"])
        date = r["date"]
        key = (zone, date)
        rec = records.setdefault(key, {"zone": zone, "weekDate": date})
        for src, dst in [("mcs", "mcs"), ("mca", "mca"), ("mcm", "mcm"), ("sal", "salvations"), ("vis", "visitations")]:
            val = to_int(r.get(src))
            if val is not None:
                rec[dst] = val

    with open(UPDATES_FILE) as f:
        updates = json.load(f)

    for entry in updates:
        date = entry["date"]
        for row in entry["rows"]:
            zone = ZONE_NORMALIZE.get(row["zone"], row["zone"])
            key = (zone, date)
            rec = records.setdefault(key, {"zone": zone, "weekDate": date})
            for src, dst in [("mcs", "mcs"), ("mca", "mca"), ("mcm", "mcm"), ("salvations", "salvations")]:
                val = to_int(row.get(src))
                if val is not None:
                    rec[dst] = val

    out_records = []
    for (zone, date), rec in sorted(records.items()):
        for field in FIELDS:
            rec.setdefault(field, None)
        out_records.append(rec)

    zones = sorted(set(r["zone"] for r in out_records))
    dates = sorted(set(r["weekDate"] for r in out_records))

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(
            {
                "description": "WHKTKT zone-level weekly Oikos metrics (mcs, mcm, mca, salvations, visitations)",
                "recordCount": len(out_records),
                "zoneCount": len(zones),
                "weekCount": len(dates),
                "dateRange": f"{dates[0]} - {dates[-1]}",
                "zones": zones,
                "records": out_records,
            },
            f,
            indent=2,
        )

    print(f"Resolved: {len(out_records)} records | {len(zones)} zones | {len(dates)} weeks")
    print(f"Date range: {dates[0]} - {dates[-1]}")
    print(f"Zones: {', '.join(zones)}")


if __name__ == "__main__":
    main()
