# Project Zoe Server — Architecture Notes

## 1. Multi-Tenancy

**Current approach: row-level multi-tenancy** (migration from schema-per-tenant is complete).

- Single PostgreSQL database, single connection pool, `public` schema for all tenants.
- Every entity that holds tenant data has a `tenant: Tenant` relation (FK `tenantId`).
- `TenantAwareRepository<E>` (`shared/repository/`) wraps TypeORM's `Repository` and automatically injects `WHERE tenant.id = :tenantId` into every `find`, `findOne`, `findAndCount`, and `save`. Services that need tenant-scoped queries should extend this class.
- The active tenant is resolved per-request via `TenantContext` (AsyncLocalStorage) set by `tenant.interceptor.ts`.
- `DbService` no longer manages schema-based connections — `getConnection()` returns the single shared connection for backward compatibility.

---

## 2. Group Hierarchy

### Real-world vs structural groups

Groups exist in three real-world domains and one organisational layer, captured
by `GroupCategoryPurpose` on the `GroupCategory` entity:

| Purpose        | What it represents                          | Examples                          |
|----------------|---------------------------------------------|-----------------------------------|
| `fellowship`   | Pastoral units where members belong         | Missional Community, Cell Group   |
| `location`     | Physical meeting places                     | Campus, Venue                     |
| `serving_team` | Ministry / function teams                   | Media Team, Worship Team          |
| `structure`    | Organisational containers (no own workflow) | FOB, Zone, Region, Department     |

`fellowship` and `location` are intentionally separate — a fellowship is *who
you belong to pastorally*; a location is *where you physically meet*. They
can overlap but have distinct workflows (attendance/schedule vs check-in/display).

`structure` groups exist purely to organise the three real-world types into a
navigable hierarchy. They do not participate directly in any workflow.

### Hierarchy depth example (WHM)

```
Tenant
└── Region        (structure)
    └── FOB        (structure)   — cluster of nearby Locations
        └── Location (location)  — the physical venue; metaData.code = 'WHKTKT'
            └── Zone   (structure)
                └── MC  (fellowship) — the small group
```

Location codes are stored in `Group.metaData.code`. Vision targets are stored in
`Group.metaData.targets`: `{ pga: 1000, mca: 1000, disc: 2000, mcs: 120 }`.

### Permissions and data visibility

All four types share the same parent/child tree (`Group.parentId`).

**Edit permissions** cascade downward automatically.
`GroupPermissionsService.hasPermissionForGroup` walks ancestors, so a leader of
a FOB (structure) can edit every group nested under it without being explicitly
assigned to each one.

**Data visibility** (reports, attendance) is expanded via
`GroupPermissionsService.getUserGroupIds` → `GroupTreeService.getGroupAndAllChildren`.
This returns a leader's direct groups plus all descendants, which is then used
as the access-control set for report queries.

### Fellowship attendance endpoint scope

`FellowshipAttendanceService.getMyMembers`, `getMySchedule`, and
`recordReportAttendance` are intentionally scoped to **direct fellowship
leaders only** — the person assigned as `Leader` of the MC itself.

A FOB or Zone leader is not a direct MC leader, so these endpoints return empty
/ no-schedule for them by design. Higher-level leaders access member and
schedule data through the reports layer, which applies the full group-tree
expansion described above.

This boundary exists to keep the submit path unambiguous: attendance is recorded
by the shepherd responsible for a specific MC, not by anyone above them in the
hierarchy.

---

## 3. Attendance Architecture

### Core principle

**Attendance tracking (real-time check-in) is strictly separated from reporting (submitted aggregate context).**

`ServiceInstance` and `FellowshipInstance` are for individual check-ins only.
Aggregate counts, context, and metrics all go through the `Report` / `ReportSubmission`
system. Never add reporting fields to `ServiceInstance`.

### Three tracks

**Track 1 — Scheduled gatherings (individual check-in)**
```
ServiceSchedule → ServiceInstance → ServiceAttendance
FellowshipSchedule → FellowshipInstance → FellowshipAttendance
```
`ServiceInstance.cachedTotalCount` is a denormalised headcount kept in sync with
individual `ServiceAttendance` rows — used for dashboard speed.

**Track 2 — One-off events**
```
Event → EventRegistration (optional) → EventAttendance
```

**Track 3 — Aggregate reporting**
```
Report → ReportSubmission   (data: jsonb, linked to a Group)
```

### Service type classification — tags, not a rigid field

`ServiceSchedule.tags: string[]` carries flexible metadata from `SUGGESTED_TAGS`
(`attendance/constants/suggested-tags.ts`): timing, language, audience, format, special.

This enables cross-location aggregation without code changes:
- English PGA = sum of `cachedTotalCount` for instances where schedule includes `'English'` tag.
- "Youth attendance across all locations" = filter schedules by `'Youth'` tag.

---

## 4. Reports System

| Entity | Purpose |
|--------|---------|
| `Report` | Template: fields, frequency, target group category, optional `functionName` for computed reports |
| `ReportField` | One form field on a `Report` (text, number, date, select, checkbox) |
| `ReportSubmission` | One submitted instance: linked to a `Group`, holds `data: jsonb` |
| `ReportSubmissionData` | Normalised field-by-field rows linked to a `ReportSubmission` |
| `ReportMetricFieldMap` | Maps metric keys to field names for `functionName`-driven reports |

`ReportSubmission` has `submittedAt` (when entered) and `reportingPeriod` (which
period the data covers — `'YYYY-MM-DD'` for weekly, `'YYYY-MM'` for monthly).
Use `reportingPeriod` as the time axis for all trend queries; `submittedAt` is
for audit purposes only.

The `functionName` switch in `reports.service.ts` (~line 443) dispatches to custom
computation functions. New computed report types are registered there.

---

## 5. ORM / Schema

The project uses TypeORM with `synchronize` controlled by the `DB_SYNCHRONIZE`
environment variable (`true` in development, `false` in production). There is no
migrations directory — production schema changes must be applied manually or via
a migration script.

## 6. Seeding

`ComprehensiveSeedService` seeds default group categories with their `purpose`
values. If a category already exists without a purpose, the seed will stamp the
correct purpose on it — making it safe to re-run after the `purpose` column is
added in production.
