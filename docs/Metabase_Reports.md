# Fellowship Attendance Reporting - Documentation

## Overview

This system tracks fellowship attendance through a flexible reporting framework that maps custom report fields to standardized metrics, enabling consistent dashboards across different report configurations.

## Architecture

### Core Components

1. **report_metric_field_map** - Maps report-specific field names to standardized metric keys
2. **Postgres Views** - Pre-aggregated data layers for analytics
3. **Metabase Dashboards** - Visual reporting interface for leaders
4. **TypeORM Entity** - Database schema management

### Data Flow

```
Report Submissions (raw data)
    ↓
report_metric_field_map (standardization layer)
    ↓
v_fellowship_attendance_facts (normalized facts)
    ↓
v_fellowship_attendance_weekly/monthly (aggregations)
    ↓
Metabase Dashboards (visualization)
```

---

## Database Schema

### 1. Mapping Table

**Entity:** `ReportMetricFieldMap`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Report } from './report.entity';

@Entity('report_metric_field_map')
@Index(['tenant', 'report', 'metricKey'], { unique: true })
export class ReportMetricFieldMap {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Report, { nullable: false })
  report: Report;

  @Column()
  metricKey: string;

  @Column()
  reportFieldName: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**Purpose:** Maps custom report field names (e.g., `smallGroupAttendanceCount`) to standardized metric keys (e.g., `attendance`), allowing dashboards to work across different report configurations.

**Sample Data:**
```sql
INSERT INTO report_metric_field_map (tenantId, reportId, metricKey, reportFieldName)
VALUES (1, 123, 'attendance', 'smallGroupAttendanceCount');
```

---

## Analytics Views

### 1. Facts View - `v_fellowship_attendance_facts`

**Purpose:** Normalized, row-per-submission view with parsed attendance values.

```sql
CREATE OR REPLACE VIEW v_fellowship_attendance_facts AS
SELECT
  r."tenantId" AS "tenantId",
  rs.id AS "submissionId",
  rs."submittedAt" AS "submittedAt",
  rs."groupId" AS "fellowshipId",
  g.name AS "fellowshipName",
  r.id AS "reportId",
  r.name AS "reportName",
  CASE 
    WHEN rsd."fieldValue" ~ '^\d+$' THEN rsd."fieldValue"::INT
    ELSE NULL 
  END AS attendance
FROM report_submission rs
JOIN report r ON r.id = rs."reportId"
JOIN "group" g ON g.id = rs."groupId"
JOIN report_submission_data rsd ON rsd."reportSubmissionId" = rs.id
JOIN report_field rf ON rf.id = rsd."reportFieldId"
JOIN report_metric_field_map m
  ON m."tenantId" = r."tenantId"
  AND m."reportId" = r.id
  AND m."metricKey" = 'attendance'
  AND m."reportFieldName" = rf.name;
```

**Columns:**
- `tenantId` - Tenant identifier for multi-tenant isolation
- `submissionId` - Unique submission ID
- `submittedAt` - Timestamp of submission
- `fellowshipId` - Group ID
- `fellowshipName` - Human-readable group name
- `reportId` - Report definition ID
- `reportName` - Report definition name
- `attendance` - Parsed integer attendance value (NULL if invalid)

**Key Features:**
- Regex validation ensures only numeric values are parsed
- Joins through mapping table for field standardization
- Includes group names for easier reporting

---

### 2. Weekly Aggregation - `v_fellowship_attendance_weekly`

**Purpose:** Weekly attendance totals per fellowship.

```sql
CREATE OR REPLACE VIEW v_fellowship_attendance_weekly AS
SELECT
  "tenantId",
  "fellowshipId",
  "fellowshipName",
  DATE_TRUNC('week', "submittedAt")::DATE AS "weekStart",
  SUM(attendance) AS "attendanceTotal",
  COUNT(*) AS "submissionCount"
FROM v_fellowship_attendance_facts
WHERE attendance IS NOT NULL
GROUP BY "tenantId", "fellowshipId", "fellowshipName", DATE_TRUNC('week', "submittedAt")::DATE;
```

**Columns:**
- `weekStart` - Monday of the week (Postgres default)
- `attendanceTotal` - Sum of all attendance for that fellowship that week
- `submissionCount` - Number of submissions that week

**Use Cases:**
- Weekly trend analysis
- Fellowship comparison by week
- Submission frequency tracking

---

### 3. Monthly Aggregation - `v_fellowship_attendance_monthly`

**Purpose:** Monthly attendance totals per fellowship.

```sql
CREATE OR REPLACE VIEW v_fellowship_attendance_monthly AS
SELECT
  "tenantId",
  "fellowshipId",
  "fellowshipName",
  DATE_TRUNC('month', "submittedAt")::DATE AS "monthStart",
  SUM(attendance) AS "attendanceTotal",
  COUNT(*) AS "submissionCount"
FROM v_fellowship_attendance_facts
WHERE attendance IS NOT NULL
GROUP BY "tenantId", "fellowshipId", "fellowshipName", DATE_TRUNC('month', "submittedAt")::DATE;
```

**Columns:**
- `monthStart` - First day of the month
- `attendanceTotal` - Sum of all attendance for that fellowship that month
- `submissionCount` - Number of submissions that month

**Use Cases:**
- Monthly reporting
- Long-term trend analysis
- Year-over-year comparisons

---

### 4. Missing Submissions - `v_missing_fellowship_submissions`

**Purpose:** Identifies fellowships that haven't submitted reports for the current week.

```sql
CREATE OR REPLACE VIEW v_missing_fellowship_submissions AS
WITH expected AS (
  SELECT 
    g."tenantId",
    g.id AS "fellowshipId",
    g.name AS "fellowshipName",
    DATE_TRUNC('week', CURRENT_DATE)::DATE AS "weekStart"
  FROM "group" g
  JOIN group_category gc ON gc.id = g."categoryId"
  WHERE gc.name ILIKE '%missional%'
),
actual AS (
  SELECT DISTINCT
    "tenantId",
    "fellowshipId",
    "weekStart"
  FROM v_fellowship_attendance_weekly
  WHERE "weekStart" = DATE_TRUNC('week', CURRENT_DATE)::DATE
)
SELECT 
  e."tenantId",
  e."fellowshipId",
  e."fellowshipName",
  e."weekStart"
FROM expected e
LEFT JOIN actual a 
  ON e."tenantId" = a."tenantId"
  AND e."fellowshipId" = a."fellowshipId"
WHERE a."fellowshipId" IS NULL
ORDER BY e."fellowshipName";
```

**Logic:**
1. `expected` - All active fellowships (identified by group category containing "missional")
2. `actual` - Fellowships that submitted this week
3. LEFT JOIN finds fellowships in expected but not in actual

**Configuration Required:**
- Update `WHERE gc.name ILIKE '%missional%'` to match your fellowship category naming convention

**Use Cases:**
- Compliance monitoring
- Follow-up with non-reporting fellowships
- Submission rate KPIs

---

## Metabase Dashboard Setup

### Dashboard: "Fellowship Attendance Overview"

#### KPI Cards (Top Row)

1. **Total Attendance Last Week**
   - View: `v_fellowship_attendance_weekly`
   - Filter: `weekStart = Previous week`, `tenantId = 1`
   - Metric: Sum of `attendanceTotal`
   - Visualization: Number

2. **Fellowships Reported Last Week**
   - View: `v_fellowship_attendance_weekly`
   - Filter: `weekStart = Previous week`, `tenantId = 1`
   - Metric: Count of rows
   - Visualization: Number

3. **Missing Fellowships Count**
   - View: `v_missing_fellowship_submissions`
   - Filter: `tenantId = 1`
   - Metric: Count of rows
   - Visualization: Number (red if > 0)

#### Visualizations

4. **Last Week Fellowship Attendance** (Bar Chart)
   - View: `v_fellowship_attendance_weekly`
   - Filter: `weekStart = Previous week`, `tenantId = 1`
   - X-axis: `fellowshipName`
   - Y-axis: `attendanceTotal`

5. **Weekly Attendance Trend** (Line Chart)
   - View: `v_fellowship_attendance_weekly`
   - Filter: `weekStart in previous 12 weeks`, `tenantId = 1`
   - X-axis: `weekStart`
   - Y-axis: `attendanceTotal`
   - Optional: Group by `fellowshipName` for multi-line chart

6. **Missing Submissions This Week** (Table)
   - View: `v_missing_fellowship_submissions`
   - Filter: `tenantId = 1`
   - Columns: `fellowshipName`, `weekStart`

#### Dashboard Filters

- **Date Range** - Wire to `weekStart` in weekly views
- **Fellowship** (optional) - Wire to `fellowshipName` for filtering

---

## Migration Steps

### Initial Setup

1. **Create the mapping table:**
   ```bash
   npm run migration:generate -- src/migrations/AddReportMetricFieldMap
   npm run migration:run
   ```

2. **Populate initial mappings:**
   ```sql
   INSERT INTO report_metric_field_map (tenantId, reportId, metricKey, reportFieldName)
   SELECT DISTINCT 
     r."tenantId",
     r.id,
     'attendance',
     'smallGroupAttendanceCount'
   FROM report r
   JOIN report_field rf ON rf."reportId" = r.id
   WHERE rf.name = 'smallGroupAttendanceCount'
   ON CONFLICT DO NOTHING;
   ```

3. **Create all views:**
   - Run all four CREATE VIEW statements in order
   - Views have no dependencies on each other except facts → weekly/monthly

4. **Test data integrity:**
   ```sql
   -- Verify mapping table
   SELECT * FROM report_metric_field_map;
   
   -- Test facts view
   SELECT * FROM v_fellowship_attendance_facts LIMIT 10;
   
   -- Test weekly aggregation
   SELECT * FROM v_fellowship_attendance_weekly 
   WHERE "weekStart" >= CURRENT_DATE - INTERVAL '4 weeks';
   
   -- Test missing submissions
   SELECT * FROM v_missing_fellowship_submissions;
   ```

5. **Sync Metabase:**
   - Admin → Databases → Sync database schema now
   - Admin → Table Metadata → Set column types

---

## Maintenance & Operations

### Adding New Report Types

When adding a new report with an attendance field:

```sql
INSERT INTO report_metric_field_map (tenantId, reportId, metricKey, reportFieldName)
VALUES (
  <tenant_id>,
  <report_id>,
  'attendance',
  '<your_field_name>'
);
```

### Adding New Metrics

To track additional metrics (e.g., first-timers, offerings):

1. Add new mappings:
   ```sql
   INSERT INTO report_metric_field_map (tenantId, reportId, metricKey, reportFieldName)
   VALUES (1, 123, 'first_timers', 'newVisitorsCount');
   ```

2. Create parallel views:
   - `v_fellowship_first_timers_facts`
   - `v_fellowship_first_timers_weekly`
   - etc.

### Troubleshooting

**No data in views:**
- Check mapping table has entries: `SELECT * FROM report_metric_field_map;`
- Verify field names match exactly: `SELECT DISTINCT rf.name FROM report_field rf WHERE rf."reportId" = <id>;`
- Check submissions exist: `SELECT COUNT(*) FROM report_submission WHERE "reportId" = <id>;`

**Week boundaries wrong:**
- Postgres `DATE_TRUNC('week', ...)` uses Monday as week start
- To change to Sunday: `DATE_TRUNC('week', "submittedAt" + INTERVAL '1 day') - INTERVAL '1 day'`

**Missing fellowships not showing:**
- Verify group category filter: `SELECT * FROM group_category WHERE name ILIKE '%missional%';`
- Update view WHERE clause to match your category naming

---

## Future Enhancements

### Location-Based Reporting

Add location views by joining to location data:

```sql
CREATE VIEW v_location_attendance_weekly AS
SELECT
  l."tenantId",
  l.id AS "locationId",
  l.name AS "locationName",
  DATE_TRUNC('week', f."submittedAt")::DATE AS "weekStart",
  SUM(f.attendance) AS "attendanceTotal"
FROM v_fellowship_attendance_facts f
JOIN "group" g ON g.id = f."fellowshipId"
JOIN location l ON l.id = g."locationId"
GROUP BY l."tenantId", l.id, l.name, DATE_TRUNC('week', f."submittedAt")::DATE;
```

### API Endpoints for Mobile/Web

Expose views through NestJS:

```typescript
@Get('analytics/fellowships/attendance/weekly')
async getWeeklyAttendance(
  @Query('tenantId') tenantId: number,
  @Query('from') from: string,
  @Query('to') to: string,
) {
  return this.dataSource.query(
    `SELECT * FROM v_fellowship_attendance_weekly 
     WHERE "tenantId" = $1 
     AND "weekStart" BETWEEN $2 AND $3
     ORDER BY "weekStart" DESC`,
    [tenantId, from, to]
  );
}
```

### Embedded Dashboards

For signed embedding in React/Flutter apps, generate tokens from NestJS backend using Metabase secret key.

---

## Security Considerations

### Tenant Isolation

All views include `tenantId` filtering. For production:

1. **Option A: Row-Level Security (RLS)**
   ```sql
   ALTER TABLE report_submission ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON report_submission
   USING ("tenantId" = current_setting('app.tenant_id')::int);
   ```

2. **Option B: Application-Level** (current approach)
   - Always filter by `tenantId` in Metabase questions
   - Always pass `tenantId` in API queries
   - Use separate Metabase connections per tenant (for larger deployments)

### Metabase Access

- Create read-only database user for Metabase
- Grant SELECT only on views and necessary tables
- Never grant write permissions

```sql
CREATE USER metabase_reader WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE yourdb TO metabase_reader;
GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON v_fellowship_attendance_facts TO metabase_reader;
GRANT SELECT ON v_fellowship_attendance_weekly TO metabase_reader;
GRANT SELECT ON v_fellowship_attendance_monthly TO metabase_reader;
GRANT SELECT ON v_missing_fellowship_submissions TO metabase_reader;
```

