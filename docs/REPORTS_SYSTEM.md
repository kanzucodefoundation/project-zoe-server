# Reports System

The reports system provides a flexible, tenant-configurable layer for aggregate data
submission and retrieval. It is intentionally separate from the check-in attendance
system (see `docs/ATTENDANCE_ARCHITECTURE.md`).

---

## Entity Model

```
Report
├── fields: ReportField[]          — form field definitions
├── submissions: ReportSubmission[]
└── metricFieldMaps: ReportMetricFieldMap[]  — for functionName reports

ReportSubmission
├── report: Report
├── group: Group                   — which group submitted this
├── user: User                     — who submitted it
├── submittedAt: Date              — when it was entered (audit)
├── reportingPeriod?: string       — which period the data covers (time axis)
├── data: jsonb                    — field values keyed by ReportField.name
└── submissionData: ReportSubmissionData[]  — normalised alternative to data jsonb

ReportSubmissionData
├── reportSubmission: ReportSubmission
├── reportField: ReportField
└── fieldValue: string

ReportMetricFieldMap
├── tenant: Tenant
├── report: Report
├── metricKey: string              — standardised metric name (e.g. 'mca', 'pga')
└── reportFieldName: string        — the ReportField.name it maps to
```

---

## Report Configuration

| Field | Purpose |
|-------|---------|
| `name` | Human-readable template name |
| `submissionFrequency` | `'daily' \| 'weekly' \| 'monthly' \| 'custom'` |
| `targetGroupCategory` | Scopes the report to a specific group category (e.g. Location, Zone). Controls which groups appear in the submission UI and permission checks. |
| `functionName` | If set, routes retrieval through a custom function instead of returning raw submissions. See §Custom Functions below. |
| `viewType` | Default visualisation (`'table'`, `'bargraph'`, `'linechart'`, etc.) |
| `sqlQuery` | Raw SQL for Metabase-style reports (optional) |
| `displayColumns` | Ordered column config for table views |
| `footer` | Summary rows appended to table output |
| `groupFieldName` | The `ReportField.name` that contains the group identifier, used for automatic group association on submission |
| `status` | `DRAFT \| PUBLISHED` — only published reports appear in leader UI |

---

## ReportField Types

Defined by `FieldType` enum:

| Type | Use |
|------|-----|
| `text` | Short free text |
| `textarea` | Long free text |
| `number` | Numeric metric (attendance, count, amount) |
| `date` | Date picker |
| `datetime` | Date + time picker |
| `select` | Dropdown — options stored in `field.options[]`. Supports `dynamic_group_selector` for database-driven group lists (see `docs/ReportFields.md`). |
| `checkbox` | Boolean |

---

## `submittedAt` vs `reportingPeriod`

| Field | What it means | When to use |
|-------|--------------|-------------|
| `submittedAt` | Timestamp of when the row was entered into the database | Audit trail only — never use as the time axis for trend queries |
| `reportingPeriod` | The period the data actually covers | Always use for filtering and sorting in dashboards |

Format convention:
- Weekly reports: `'YYYY-MM-DD'` (the Sunday date the week starts or ends)
- Monthly reports: `'YYYY-MM'`

**Why this matters for imports:** when historical data is imported in bulk, every
row gets the same `submittedAt` (the import date). Without `reportingPeriod`, a
query for "MCA trend over the past year" would show all data collapsed to a single
point in time. Always populate `reportingPeriod` on both manual submissions and
import scripts.

---

## Submission Data: `data` jsonb vs `ReportSubmissionData` rows

`ReportSubmission` stores field values in two ways:

**`data: jsonb`** — a plain object keyed by `ReportField.name`:
```json
{ "mca": 64, "mcs": 8, "salvations": 0, "baptisms": 2 }
```
Simple to write, simple to read back. Preferred for new code.

**`ReportSubmissionData` rows** — one row per field, normalised. Used by the
`getSmallGroupSummaryAttendance` function which reads `submission.submissionData`
and maps `sd.reportField.name → sd.fieldValue`. Required when the custom function
logic iterates fields explicitly.

New code may use either. If a `functionName` report needs to iterate fields
programmatically, prefer `ReportSubmissionData`. Otherwise use `data: jsonb`.

---

## Generic Reports (no `functionName`)

When `report.functionName` is null, `getReportSubmissions()` calls
`getGenericReportSubmissions()`, which returns the raw submissions with their
`submissionData` flattened into the response. No transformation is applied.

---

## Custom Function Reports

When `report.functionName` is set, the switch in `reports.service.ts` (~line 443)
dispatches to a named private method:

```typescript
switch (report.functionName) {
  case 'getSmallGroupSummaryAttendance':
    return this.getSmallGroupSummaryAttendance(...);
  case 'getSmallGroupReportSubmissionStatus':
    return this.getSmallGroupReportSubmissionStatus(...);
  default:
    throw new Error(`Function ${report.functionName} is not implemented ...`);
}
```

### Existing functions

**`getSmallGroupSummaryAttendance`**  
Returns submissions for a report, enriched with the submitting group's parent name
(e.g. the Zone name above an MC). Supports filtering by `smallGroupIdList` (CSV of
group IDs) or `parentGroupIdList` (returns all children of those parents). Uses
`ReportSubmissionData` rows to build the response object.

**`getSmallGroupReportSubmissionStatus`**  
Returns a status view of which groups have and have not submitted for a given period.
Used to track submission compliance across zones or locations.

### Adding a new function

1. Add a `case 'yourFunctionName':` to the switch in `getReportSubmissions()`.
2. Implement `private async yourFunctionName(report, startDate, endDate, ...): Promise<ReportSubmissionsApiResponse>`.
3. Return the standard `{ reportId, data, columns, footer }` shape.
4. Create the `Report` record in the database with `functionName: 'yourFunctionName'`.

For computed reports (e.g. auto-categorization), populate `ReportMetricFieldMap`
rows to declare which `ReportField.name` on this report corresponds to which
standardised metric key. This lets the computation function look up field values
by metric name regardless of how the tenant named their fields.

---

## `ReportMetricFieldMap`

Maps a standardised metric key to a `ReportField.name` for a specific report on a
specific tenant. Used when a computation function needs to find, say, the `'mca'`
value from a submission without hardcoding the field name:

```typescript
// Find which field on this report holds the 'mca' metric
const map = await metricFieldMapRepo.findOne({
  where: { tenant: { id: tenantId }, report: { id: reportId }, metricKey: 'mca' }
});
const mcaValue = submission.data[map.reportFieldName]; // e.g. submission.data['mcAttendance']
```

This decouples the computation logic from tenant-specific field naming.

---

## Permission Scoping

`Report.targetGroupCategory` controls which reports a user sees:

- If `targetGroupCategory` is null, the report is visible to all users (global report).
- If set, only users who have a membership in a group of that category (or a parent
  group) can see and submit to it.

This is enforced in `getReportsForUser()` at ~line 1211 of `reports.service.ts`.
