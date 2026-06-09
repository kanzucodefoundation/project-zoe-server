# Attendance Architecture

## Core Principle

**Check-in tracking and aggregate reporting are strictly separate.**

- `ServiceInstance` and `FellowshipInstance` are for individual check-ins only.  
- Aggregate counts, pastoral context, and submitted metrics go through `Report` / `ReportSubmission`.  
- Never add reporting fields (salvations, offering, sermon topic, etc.) to an Instance entity.

---

## Three Tracks

### Track 1 — Services (Sunday worship, midweek)

```
ServiceSchedule      →    ServiceInstance      →    ServiceAttendance
(recurring config)        (one occurrence)          (one person, one check-in)
```

**`ServiceSchedule`** — configuration for a recurring service at a location:
- `location: Group` — which Location group this service belongs to
- `serviceType` — `'Sunday' | 'Midweek' | 'Special'`
- `frequency` — `'weekly' | 'biweekly' | 'monthly'`
- `startTime`, `daysOfWeek`
- `tags: string[]` — flexible classification (see §Tags below)
- `metaData` — optional structured extras (`expectedAttendance`, `hasChildrensProgram`, `livestreamEnabled`)

**`ServiceInstance`** — one concrete occurrence of a schedule:
- `serviceDate: string` — the date of this occurrence (`YYYY-MM-DD`)
- `status` — `'scheduled' | 'active' | 'completed' | 'cancelled'`
- `cachedTotalCount: number` — denormalised headcount, kept in sync by `ServiceAttendanceService`. Use this for dashboard queries; do not sum `ServiceAttendance` rows directly.

**`ServiceAttendance`** — one person at one instance:
- `contact: Contact`, `isFirstTime: boolean`, `isChild: boolean`
- `checkedInBy: User`, `checkedInAt: Date`

---

### Track 2 — Fellowships (weekly MC / small group meetings)

```
FellowshipSchedule   →    FellowshipInstance   →    FellowshipAttendance
(recurring config)        (one occurrence)          (one person, one check-in)
```

**`FellowshipSchedule`** — configuration for a recurring MC meeting:
- `fellowshipGroup: Group` — the MC (fellowship-purpose group)
- `meetingDay: number` — 0–6 (0 = Sunday)
- `startTime`, `frequency`

**`FellowshipInstance`** — one concrete meeting:
- `meetingDate: string`
- `cachedMemberCount: number` — members who attended
- `cachedVisitorCount: number` — non-members who attended
- `cachedTotalCount: number` — sum of the above
- All three are maintained atomically by `FellowshipAttendanceService`.

**`FellowshipAttendance`** — one person at one meeting:
- `contact: Contact`, `isMember: boolean`
- `checkedInBy: User`

---

### Track 3 — Aggregate reporting

```
Report   →   ReportSubmission
(template)   (one submitted set of data, linked to a Group)
```

Used when locations submit headcounts without individual check-in records — which is the default for most tenants. See `docs/REPORTS_SYSTEM.md` for the full model.

The two tracks can coexist for the same gathering: a location that uses check-in will have a `ServiceInstance` with `cachedTotalCount`, and the pastor then submits a `ReportSubmission` for the same date with additional context (offering, salvations, sermon topic). The `ReportSubmission` can optionally reference the instance via `relatedInstanceId` / `relatedInstanceType` (planned — not yet implemented) to enable discrepancy detection.

---

## Tag-Based Service Classification

`ServiceSchedule.tags` is a `string[]` drawn from the `SUGGESTED_TAGS` catalogue
(`attendance/constants/suggested-tags.ts`). Tags are multi-dimensional — a single
schedule can carry tags from several categories simultaneously.

| Category | Purpose | Examples |
|----------|---------|---------|
| `timing` | Order of service in the day | `First`, `Second`, `Third` |
| `language` | Primary language spoken | `English`, `Luganda`, `Swahili`, `French` |
| `audience` | Target demographic | `General`, `Children`, `Teens`, `Youth`, `Adults` |
| `format` | Delivery method | `In_Person`, `Hybrid`, `Online_Only`, `Outdoor` |
| `special` | One-off attributes | `Baptism_Service`, `Communion`, `Evangelistic` |

**Why tags matter for reporting:**

Tags enable cross-location aggregation without rigid schema columns. Examples:

```sql
-- English PGA: sum cachedTotalCount for all instances
-- whose schedule contains 'English' in its tags array
WHERE 'English' = ANY(schedule.tags)

-- Youth attendance across all locations this month
WHERE 'Youth' = ANY(schedule.tags)
  AND instance.serviceDate >= '2026-06-01'
```

EPGA (English Physical Garage Attendance) is always a derived figure — the sum of
`cachedTotalCount` across instances where the schedule includes the `'English'` tag.
It is never stored as a separate field.

---

## Denormalised Count Maintenance

Both `ServiceInstance.cachedTotalCount` and `FellowshipInstance.cachedTotalCount`
(plus `cachedMemberCount` / `cachedVisitorCount`) are kept in sync by the
respective service layers:

- **`ServiceAttendanceService`** — increments / decrements `cachedTotalCount` on
  `ServiceInstance` whenever a `ServiceAttendance` row is created or removed.
- **`FellowshipAttendanceService`** — updates all three cached counts on
  `FellowshipInstance` on every attendance change.

Do not update these columns directly from outside the attendance services.

---

## What Does Not Belong on Instance Entities

These are reporting concerns and belong in `ReportSubmission.data`:

- Salvations, baptisms, first-time guest counts (beyond `isFirstTime` on the individual row)
- Offering / income figures
- Sermon topic or speaker
- Serving team / mechanics count
- Cars parked, buses, ALC attendance
- Any pastor-supplied narrative context
