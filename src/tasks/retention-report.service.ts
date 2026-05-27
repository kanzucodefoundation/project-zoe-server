import { Inject, Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';

export interface MonthlyRow {
  month: number;
  monthName: string;
  totalNewContacts: number;
  successfulCallsMade: number;
  wantToJoinMC: number;
  servingTeam: number;
  teaHangout: number;
  baptism: number;
}

export interface WeeklyRow {
  weekStart: string;
  label: string;
  totalNewContacts: number;
  successfulCallsMade: number;
  wantToJoinMC: number;
  servingTeams: number;
  teaHangout: number;
  baptism: number;
}

const ACTIVITY_TYPES = [
  ContactActivityType.MATCHED_TO_FELLOWSHIP,
  ContactActivityType.JOINED_SERVING_TEAM,
  ContactActivityType.ATTENDED_FELLOWSHIP,
  ContactActivityType.GOT_BAPTISED,
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

// Converts a pg date value (string or Date) to YYYY-MM-DD without UTC day shifting
const toDateStr = (d: Date | string): string =>
  typeof d === 'string' ? d.slice(0, 10) : formatLocalDate(d);

// Sunday-start week expression: the Sunday on or before the given timestamp
const SUNDAY_WEEK_EXPR = (col: string) =>
  `(date_trunc('week', ${col} + interval '1 day') - interval '1 day')::date`;

@Injectable()
export class RetentionReportService {
  constructor(
    @Inject('CONNECTION') private readonly connection: Connection,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSummary(
    from: Date,
    to: Date,
  ): Promise<{
    recorded: number;
    retained: number;
    joinedFellowship: number;
    joinedServingTeam: number;
    baptised: number;
  }> {
    const tenantId = this.tenantContext.requireTenant();

    const countDistinctByType = async (
      types: ContactActivityType[],
    ): Promise<number> => {
      const result = await this.connection.query(
        `SELECT COUNT(DISTINCT "contactId") AS cnt
         FROM contact_activity
         WHERE "tenantId" = $1
           AND type::text = ANY($2::text[])
           AND "occurredAt" BETWEEN $3 AND $4`,
        [tenantId, types, from, to],
      );
      return parseInt(result[0].cnt, 10);
    };

    const recordedResult = await this.connection.query(
      `SELECT COUNT(DISTINCT t."contactId") AS cnt
       FROM task t
       WHERE t."tenantId" = $1
         AND t."createdAt" BETWEEN $2 AND $3
         AND NOT EXISTS (
           SELECT 1 FROM task t2
           WHERE t2."tenantId" = t."tenantId"
             AND t2."contactId" = t."contactId"
             AND t2."createdAt" < $2
         )`,
      [tenantId, from, to],
    );
    const recorded = parseInt(recordedResult[0].cnt, 10);

    const retained = await countDistinctByType([
      ContactActivityType.ATTENDED_FELLOWSHIP,
      ContactActivityType.JOINED_SERVING_TEAM,
      ContactActivityType.GOT_BAPTISED,
    ]);

    const joinedFellowship = await countDistinctByType([
      ContactActivityType.ATTENDED_FELLOWSHIP,
    ]);

    const joinedServingTeam = await countDistinctByType([
      ContactActivityType.JOINED_SERVING_TEAM,
    ]);

    const baptised = await countDistinctByType([
      ContactActivityType.GOT_BAPTISED,
    ]);

    return {
      recorded,
      retained,
      joinedFellowship,
      joinedServingTeam,
      baptised,
    };
  }

  async getMonthlyBreakdown(
    year: number,
  ): Promise<{ year: number; months: MonthlyRow[] }> {
    const tenantId = this.tenantContext.requireTenant();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const [newContactsRows, callsRows, activityRows] = await Promise.all([
      this.connection.query(
        `WITH first_tasks AS (
           SELECT "contactId", MIN("createdAt") AS first_at
           FROM task
           WHERE "tenantId" = $1
           GROUP BY "contactId"
         )
         SELECT EXTRACT(MONTH FROM first_at)::int AS month, COUNT(*) AS cnt
         FROM first_tasks
         WHERE first_at >= $2 AND first_at < $3
         GROUP BY EXTRACT(MONTH FROM first_at)`,
        [tenantId, yearStart, yearEnd],
      ),
      this.connection.query(
        `SELECT EXTRACT(MONTH FROM "completedAt")::int AS month, COUNT(*) AS cnt
         FROM task
         WHERE "tenantId" = $1
           AND type = 'call'
           AND status != 'unreachable'
           AND "completedAt" >= $2
           AND "completedAt" < $3
         GROUP BY EXTRACT(MONTH FROM "completedAt")`,
        [tenantId, yearStart, yearEnd],
      ),
      this.connection.query(
        `SELECT EXTRACT(MONTH FROM "occurredAt")::int AS month,
                type,
                COUNT(DISTINCT "contactId") AS cnt
         FROM contact_activity
         WHERE "tenantId" = $1
           AND "occurredAt" >= $2
           AND "occurredAt" < $3
           AND type::text = ANY($4::text[])
         GROUP BY EXTRACT(MONTH FROM "occurredAt"), type`,
        [tenantId, yearStart, yearEnd, ACTIVITY_TYPES],
      ),
    ]);

    const newContactsMap = new Map<number, number>(
      newContactsRows.map((r: any) => [r.month, parseInt(r.cnt, 10)]),
    );
    const callsMap = new Map<number, number>(
      callsRows.map((r: any) => [r.month, parseInt(r.cnt, 10)]),
    );
    const activityMap = new Map<string, number>(
      activityRows.map((r: any) => [
        `${r.month}_${r.type}`,
        parseInt(r.cnt, 10),
      ]),
    );

    const months: MonthlyRow[] = MONTH_NAMES.map((name, i) => {
      const m = i + 1;
      return {
        month: m,
        monthName: name,
        totalNewContacts: newContactsMap.get(m) ?? 0,
        successfulCallsMade: callsMap.get(m) ?? 0,
        wantToJoinMC:
          activityMap.get(`${m}_${ContactActivityType.ATTENDED_FELLOWSHIP}`) ??
          0,
        servingTeam:
          activityMap.get(`${m}_${ContactActivityType.JOINED_SERVING_TEAM}`) ??
          0,
        teaHangout:
          activityMap.get(
            `${m}_${ContactActivityType.MATCHED_TO_FELLOWSHIP}`,
          ) ?? 0,
        baptism:
          activityMap.get(`${m}_${ContactActivityType.GOT_BAPTISED}`) ?? 0,
      };
    });

    return { year, months };
  }

  async getWeeklyBreakdown(
    year: number,
  ): Promise<{ year: number; weeks: WeeklyRow[] }> {
    const tenantId = this.tenantContext.requireTenant();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const [newContactsRows, callsRows, activityRows] = await Promise.all([
      this.connection.query(
        `WITH first_tasks AS (
           SELECT "contactId", MIN("createdAt") AS first_at
           FROM task
           WHERE "tenantId" = $1
           GROUP BY "contactId"
         )
         SELECT ${SUNDAY_WEEK_EXPR('first_at')} AS week_start, COUNT(*) AS cnt
         FROM first_tasks
         WHERE first_at >= $2 AND first_at < $3
         GROUP BY week_start`,
        [tenantId, yearStart, yearEnd],
      ),
      this.connection.query(
        `SELECT ${SUNDAY_WEEK_EXPR(
          '"completedAt"',
        )} AS week_start, COUNT(*) AS cnt
         FROM task
         WHERE "tenantId" = $1
           AND type = 'call'
           AND status != 'unreachable'
           AND "completedAt" >= $2
           AND "completedAt" < $3
         GROUP BY week_start`,
        [tenantId, yearStart, yearEnd],
      ),
      this.connection.query(
        `SELECT ${SUNDAY_WEEK_EXPR('"occurredAt"')} AS week_start,
                type,
                COUNT(DISTINCT "contactId") AS cnt
         FROM contact_activity
         WHERE "tenantId" = $1
           AND "occurredAt" >= $2
           AND "occurredAt" < $3
           AND type::text = ANY($4::text[])
         GROUP BY week_start, type`,
        [tenantId, yearStart, yearEnd, ACTIVITY_TYPES],
      ),
    ]);

    const newContactsMap = new Map<string, number>(
      newContactsRows.map((r: any) => [
        toDateStr(r.week_start),
        parseInt(r.cnt, 10),
      ]),
    );
    const callsMap = new Map<string, number>(
      callsRows.map((r: any) => [toDateStr(r.week_start), parseInt(r.cnt, 10)]),
    );
    const activityMap = new Map<string, number>(
      activityRows.map((r: any) => [
        `${toDateStr(r.week_start)}_${r.type}`,
        parseInt(r.cnt, 10),
      ]),
    );

    // Generate every Sunday within the year
    const jan1 = new Date(year, 0, 1);
    const daysToFirstSunday = (7 - jan1.getDay()) % 7;
    const weeks: WeeklyRow[] = [];
    const cursor = new Date(year, 0, 1 + daysToFirstSunday);

    while (cursor.getFullYear() === year) {
      const dateStr = toDateStr(cursor);
      weeks.push({
        weekStart: dateStr,
        label: formatWeekLabel(cursor),
        totalNewContacts: newContactsMap.get(dateStr) ?? 0,
        successfulCallsMade: callsMap.get(dateStr) ?? 0,
        wantToJoinMC:
          activityMap.get(
            `${dateStr}_${ContactActivityType.ATTENDED_FELLOWSHIP}`,
          ) ?? 0,
        servingTeams:
          activityMap.get(
            `${dateStr}_${ContactActivityType.JOINED_SERVING_TEAM}`,
          ) ?? 0,
        teaHangout:
          activityMap.get(
            `${dateStr}_${ContactActivityType.MATCHED_TO_FELLOWSHIP}`,
          ) ?? 0,
        baptism:
          activityMap.get(`${dateStr}_${ContactActivityType.GOT_BAPTISED}`) ??
          0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return { year, weeks };
  }
}

const MONTH_ABBRS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatWeekLabel(date: Date): string {
  const day = date.getDate();
  const v = day % 100;
  const suffix =
    v >= 11 && v <= 13
      ? 'th'
      : ['th', 'st', 'nd', 'rd', 'th'][Math.min(day % 10, 4)];
  return `${day}${suffix} ${MONTH_ABBRS[date.getMonth()]}`;
}
