# WHM Data Import Plan

Worship Harvest Ministries (WHM) is the first tenant to receive a full historical
data import into Project Zoe. ~240 locations across Uganda. Data spans May 2022 → present.

**Status (2026-06-09):** Architecture agreed. Ready to build.  
**Next action:** Add `reportingPeriod` column to `ReportSubmission`, then seed report templates and group tree.

---

## Terminology

| Abbreviation | Meaning |
|-------------|---------|
| PGA | Physical Garage Attendance — total Sunday service headcount ("Garages" = their buildings) |
| EPGA | English PGA — English-language services only (1Sv + 2Sv + YXP); derived, not stored |
| MCA | Missional Community Attendance — weekly MC meeting headcount |
| disc | Disciples / MC Membership — total members on MC roster (MCM and disc are the same thing) |
| MCS | Number of Missional Communities |
| DIA | Discipleship Impact Assessment — breakdown of disciples by zone and MC |
| FTG | First Time Guests |
| LLP | Lead Location Pastor — one per Location; also appears as a count in categorization (clarification pending) |
| ZP | Zonal Pastor |
| MCL | MC Leader |
| FOB | Forward Operating Base — a cluster of nearby Locations under one senior leader |
| ALC | Advancing Leadership Core — Sunday noon session for adults 35+ |
| BPT | Baptisms (cumulative) |
| FTS | Full-Time Staff |
| Ops Inc | Operational Income (tithes + offerings, millions UGX) |
| Plants | Church plants started |
| SAL | Salvations + baptisms combined (zone-level report shorthand) |

---

## Group Tree

```
Tenant: Worship Harvest Ministries
└── Region (structure)            e.g. Greater Kampala East
    └── FOB (structure)           e.g. Kitukutwe FOB
        └── Location (location)   e.g. WH Kitukutwe [WHKTKT]
            └── Zone (structure)  e.g. Cathedral Zone  — ~11 per main Location
                └── MC (fellowship)  — Missional Community, the small group
```

**Leadership roles** map to `GroupMembership` with the `Leader` role:

| Title | Level |
|-------|-------|
| LLP — Lead Location Pastor | Location |
| ZP — Zonal Pastor | Zone |
| MCL — MC Leader | MC |

Location codes (e.g. `WHKTKT`) stored in `Group.metaData.code`.  
Vision targets stored in `Group.metaData.targets`: `{ pga, mca, disc, mcs, zones, llp, locations, plants }`.

**Kitukutwe FOB locations (8):**
WHKTKT, WHNKWR (Nakwero), WHNSSA (Nsasa), WHNBSG (Nabusugwe),
WHKLGI (Kalagi), WHKMNY (Kimwanyi), WHNKSJ (Nakasajja), WHKJBJ (Kijabijjo).

---

## WHM Service Slots → ServiceSchedule Tags

| WHM slot | Tags on ServiceSchedule |
|----------|------------------------|
| 1Sv — 1st service | `['English', 'First', 'In_Person']` |
| 2Sv — 2nd service | `['English', 'Second', 'In_Person']` |
| YXP — Youth Xperience | `['English', 'Youth', 'In_Person']` |
| Kids — Harvest Kids | `['English', 'Children', 'In_Person']` |
| Local — Luganda service | `['Luganda', 'In_Person']` |
| HC — Home Church / satellite | `['English', 'Home_Church']` |
| ALC — Advancing Leadership Core | `['English', 'Adults', 'In_Person']` |

---

## Report Templates to Seed

### 1. "Sunday Service Report"
- `submissionFrequency: 'weekly'`, `targetGroupCategory`: Location
- **Fields:** `1Sv`, `2Sv`, `YXP`, `kids`, `luganda`, `hc1`, `hc2`, `hc3`, `alc`,
  `ftg`, `salvations`, `mechanics`, `carParks`, `busPax`
- `ReportSubmission.reportingPeriod` = the Sunday date (`YYYY-MM-DD`)

### 2. "Weekly Oikos Report"
- `submissionFrequency: 'weekly'`, `targetGroupCategory`: Zone (or Location where no zones exist)
- **Fields:** `mcs`, `mcm`, `mca`, `salvations`, `baptisms`, `visitations`
- Attendance rate (A% = mca / mcm) is computed on read, never stored.

### 3. "Monthly Location Categorization"
- `submissionFrequency: 'monthly'`, `targetGroupCategory`: Location
- `functionName: 'locationCategorization'`
- **Fields:** `grade` (A–G), `rank`, `pga`, `mca`, `mcs`, `mission`, `missionLabel`
  (Bptms or Dscps), `plants`, `opsInc`, `fts`, `criteriaBreakdown`, `healthScore`
- Currently stored from externally-published grades. Phase 3 implements the
  `functionName` to compute live from Report data.

---

## Available Historical Data

| Dataset | Format | Date range | Location |
|---------|--------|-----------|----------|
| Weekly PGA, all ~240 locations | Excel (continuous sheet) + PDFs | May 2022 → present | `data/Other Data/`, `data/More Data/`, `data/WHM Data/` |
| Weekly EPGA | Excel + PDFs | Jun 2024 → present | `data/Other Data/`, `data/More Data/` |
| Weekly MCA / Oikos, zone-level | Excel (MC Attendance workbook) | Jan 2023 → present | `data/More Data/WHM MC ATTENDANCE 2023 -2024 (13).xlsx` |
| Monthly categorization (A–G) | Excel workbook + PDFs | May 2024 → present | `data/WHM Data/WHM March 2026 Categorization.xlsx`, `data/More Data/` |
| WHKTKT Oikos (pre-parsed) | JSON | Jan–May 2026 | `data/WHM Data/data/` |
| WHKTKT baptism/salvation tracker | JSON | May 2026 | `data/WHM Data/data/` |
| WHKTKT member database | Excel | current snapshot | referenced in zonal dashboard data |
| Champions Network (separate FOB) | Excel workbooks | 2022–2025 | `data/champions-data-drive-download-*.zip` |

> `data/` folder is temporary and not committed to git. Import scripts in
> `src/seed/whm/` must be idempotent and must not rely on the data folder existing
> in production.

---

## Schema Change Required

One column on one existing entity:

```typescript
// ReportSubmission — add:
@Column({ type: 'date', nullable: true })
reportingPeriod?: string; // 'YYYY-MM-DD' weekly / 'YYYY-MM' monthly
```

Everything else is data (report templates, submissions, groups, contacts).

---

## Import Sequence

All scripts live in `src/seed/whm/`. Each must be idempotent (safe to re-run).

1. **Migration** — add `reportingPeriod` to `ReportSubmission`
2. **Seed report templates** — 3 `Report` records + their `ReportField` rows
3. **Seed group tree** — Region → FOBs → ~240 Locations → WHKTKT zones → WHKTKT MCs
4. **Import PGA** — Excel continuous averages sheet + individual weekly sheets → `ReportSubmission` on "Sunday Service Report"
5. **Import MCA/Oikos** — MC Attendance Excel → `ReportSubmission` on "Weekly Oikos Report"
6. **Import categorization** — Excel + PDFs → `ReportSubmission` on "Monthly Location Categorization"
7. **Import WHKTKT contacts** — Master Database Excel → `Contact` + `GroupMembership`
8. **Import Champions Network** — zip Excel workbooks → same pipeline, different location codes

---

## Phased Roadmap

| Phase | Goal |
|-------|------|
| 1 | Historical import + read-only dashboards. PDF/WhatsApp reporting continues in parallel. |
| 2 | Project Zoe becomes the input interface. Leaders submit weekly numbers through the app. |
| 3 | Live A–G categorization computed from Report data (`functionName` implemented). |
