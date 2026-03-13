import { Inject, Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactActivityType } from '../crm/enums/contact-activity-type.enum';

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

    // Distinct contacts who received their first task in the period
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
    ]);

    const joinedFellowship = await countDistinctByType([
      ContactActivityType.ATTENDED_FELLOWSHIP,
    ]);

    const joinedServingTeam = await countDistinctByType([
      ContactActivityType.JOINED_SERVING_TEAM,
    ]);

    const baptised = await countDistinctByType([ContactActivityType.GOT_BAPTISED]);

    return { recorded, retained, joinedFellowship, joinedServingTeam, baptised };
  }
}
