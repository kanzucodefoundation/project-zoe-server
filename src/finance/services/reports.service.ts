import { Injectable, Inject } from '@nestjs/common';
import { Repository, Connection, Between } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Distribution from '../entities/distribution.entity';
import Group from '../../groups/entities/group.entity';
import { GroupCategoryPurpose } from '../../groups/enums/groups';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { financeDayRange } from '../finance-time';
import { getPersonFullName } from '../../crm/crm.helpers';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';

interface ReconciliationSummary {
  totalTransactions: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  reconciledCount: number;
  reconciledAmount: number;
  disputedCount: number;
  disputedAmount: number;
  matchRate: number;
  byCategory: {
    category: string;
    count: number;
    amount: number;
  }[];
}

interface DistributionSummary {
  totalDistributed: number;
  /** Keyed by location group name, per the documented branch breakdown. */
  byLocation: Record<string, number>;
  byGroup: {
    groupId: number;
    groupName: string;
    amount: number;
  }[];
  byCategory: Record<
    string,
    {
      total: number;
      distributions: {
        purpose: string;
        percentage: number;
        amount: number;
      }[];
    }
  >;
}

interface LocationSummary {
  locationId: number;
  locationName: string;
  totalReceived: number;
  totalDistributed: number;
  byCategory: {
    category: string;
    amount: number;
  }[];
}

/**
 * Spread-friendly form of financeDayRange, so a report window stays a
 * single expression at each call site.
 */
const financeDayRangeTuple = (
  startDate: string,
  endDate: string,
): [Date, Date] => {
  const { from, to } = financeDayRange(startDate, endDate);
  return [from, to];
};

@Injectable()
export class ReportsService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly matchRepository: Repository<ReconciliationMatch>;
  private readonly distributionRepository: Repository<Distribution>;
  private readonly groupRepository: Repository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.transactionRepository = connection.getRepository(Transaction);
    this.matchRepository = connection.getRepository(ReconciliationMatch);
    this.distributionRepository = connection.getRepository(Distribution);
    this.groupRepository = connection.getRepository(Group);
    this.logger = this.appLogger.createContextLogger('ReportsService');
  }

  async getReconciliationSummary(
    startDate: string,
    endDate: string,
    accountId?: number,
  ): Promise<ReconciliationSummary> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = {
      tenant: { id: tenantId },
      transactionDate: Between(...financeDayRangeTuple(startDate, endDate)),
    };

    if (accountId) {
      where.account = { id: accountId };
    }

    const transactions = await this.transactionRepository.find({
      where,
      relations: ['account'],
    });

    const summary: ReconciliationSummary = {
      totalTransactions: transactions.length,
      totalAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      reconciledCount: 0,
      reconciledAmount: 0,
      disputedCount: 0,
      disputedAmount: 0,
      matchRate: 0,
      byCategory: [],
    };

    const categoryMap = new Map<string, { count: number; amount: number }>();

    for (const transaction of transactions) {
      const amount = Number(transaction.amount);
      summary.totalAmount += amount;

      switch (transaction.status) {
        case TransactionStatus.PENDING:
          summary.pendingCount++;
          summary.pendingAmount += amount;
          break;
        case TransactionStatus.RECONCILED:
          summary.reconciledCount++;
          summary.reconciledAmount += amount;
          break;
        case TransactionStatus.DISPUTED:
          summary.disputedCount++;
          summary.disputedAmount += amount;
          break;
      }

      const category = transaction.category || 'UNCATEGORIZED';
      const existing = categoryMap.get(category) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += amount;
      categoryMap.set(category, existing);
    }

    summary.matchRate =
      summary.totalTransactions > 0
        ? (summary.reconciledCount / summary.totalTransactions) * 100
        : 0;

    summary.byCategory = Array.from(categoryMap.entries()).map(
      ([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
      }),
    );

    return summary;
  }

  /**
   * Attributes a distribution's target group to the location (branch) it sits
   * under.
   *
   * A distribution can target any group in the tree — an MC, a Zone, a
   * Location — so "by location" means walking up the parent chain to the
   * nearest ancestor whose category purpose is `location`, not renaming the
   * group. Groups above every location (Region, FOB) have no location of their
   * own and are reported as Unallocated.
   *
   * `cache` is shared across one report so a tree walked for the first
   * distribution is not walked again for the next hundred.
   */
  private async resolveLocationName(
    groupId: number | null | undefined,
    cache: Map<number, string | null>,
    tenantId: number,
  ): Promise<string | null> {
    if (!groupId) {
      return null;
    }

    const visited: number[] = [];
    let currentId: number | null = groupId;

    while (currentId) {
      if (cache.has(currentId)) {
        const cached = cache.get(currentId) ?? null;
        visited.forEach((id) => cache.set(id, cached));
        return cached;
      }

      // A cycle in the tree would otherwise spin here forever.
      if (visited.includes(currentId)) {
        break;
      }
      visited.push(currentId);

      const group = await this.groupRepository.findOne({
        where: { id: currentId, tenant: { id: tenantId } },
        relations: { category: true },
      });

      if (!group) {
        break;
      }

      if (group.category?.purpose === GroupCategoryPurpose.LOCATION) {
        visited.forEach((id) => cache.set(id, group.name));
        return group.name;
      }

      currentId = group.parentId ?? null;
    }

    visited.forEach((id) => cache.set(id, null));
    return null;
  }

  /**
   * Escapes one CSV field per RFC 4180: quote it when it contains a comma,
   * quote, CR or LF, and double any embedded quotes. The project only has CSV
   * *readers* as dependencies (csv-parse / csv-parser), so writing is done here.
   */
  private static toCsvField(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value);
    // A leading formula character is evaluated by spreadsheet applications,
    // so it is escaped before RFC 4180 quoting.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }

  /**
   * Transaction-level CSV behind the Financial Reports export button, over the
   * same window and account filter as the summary above it, so the file
   * reconciles with what is on screen.
   */
  async exportReconciliationCsv(
    startDate: string,
    endDate: string,
    accountId?: number,
  ): Promise<string> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = {
      tenant: { id: tenantId },
      transactionDate: Between(...financeDayRangeTuple(startDate, endDate)),
    };

    if (accountId) {
      where.account = { id: accountId };
    }

    const transactions = await this.transactionRepository.find({
      where,
      relations: [
        'account',
        'matches',
        'matches.contact',
        'matches.contact.person',
      ],
      order: { transactionDate: 'ASC' },
    });

    const headers = [
      'Date',
      'Account',
      'Amount',
      'Category',
      'Status',
      'Sender Name',
      'Sender Phone',
      'Reference',
      'Narration',
      'Matched Contact',
    ];

    const lines = [headers.join(',')];

    for (const transaction of transactions) {
      // Only an approved match says who the money came from; a pending
      // suggestion is not a reconciliation and must not read as one.
      const approved = transaction.matches?.find(
        (match) => match.status === MatchStatus.APPROVED,
      );
      const matchedContact = approved?.contact
        ? getPersonFullName(approved.contact.person)
        : '';

      lines.push(
        [
          transaction.transactionDate
            ? new Date(transaction.transactionDate).toISOString().split('T')[0]
            : '',
          transaction.account?.name,
          transaction.amount,
          transaction.category,
          transaction.status,
          transaction.senderName,
          transaction.senderPhone,
          transaction.externalReference,
          transaction.narration,
          matchedContact,
        ]
          .map((field) => ReportsService.toCsvField(field))
          .join(','),
      );
    }

    this.logger.business('log', 'Exported reconciliation CSV', {
      operation: 'exportReconciliationCsv',
      resource: 'transactions',
      metadata: {
        startDate,
        endDate,
        accountId,
        rowCount: transactions.length,
      },
    });

    // Trailing newline so the last row is terminated like the others.
    return `${lines.join('\n')}\n`;
  }

  async getDistributionsByPeriod(
    startDate: string,
    endDate: string,
  ): Promise<DistributionSummary> {
    const tenantId = this.tenantContext.requireTenant();

    const distributions = await this.distributionRepository.find({
      where: {
        tenant: { id: tenantId },
        createdAt: Between(...financeDayRangeTuple(startDate, endDate)),
      },
      relations: ['targetGroup', 'targetAccount'],
    });

    const summary: DistributionSummary = {
      totalDistributed: 0,
      byGroup: [],
      byLocation: {},
      byCategory: {},
    };

    const groupMap = new Map<number, { groupName: string; amount: number }>();
    const locationCache = new Map<number, string | null>();

    for (const distribution of distributions) {
      const amount = Number(distribution.amount);
      summary.totalDistributed += amount;

      if (distribution.targetGroup) {
        const existing = groupMap.get(distribution.targetGroup.id) || {
          groupName: distribution.targetGroup.name,
          amount: 0,
        };
        existing.amount += amount;
        groupMap.set(distribution.targetGroup.id, existing);
      }

      const location =
        (await this.resolveLocationName(
          distribution.targetGroup?.id,
          locationCache,
          tenantId,
        )) || 'Unallocated';
      summary.byLocation[location] =
        (summary.byLocation[location] || 0) + amount;

      const category = distribution.category || 'UNCATEGORIZED';
      const bucket = summary.byCategory[category] || {
        total: 0,
        distributions: [],
      };
      bucket.total += amount;
      bucket.distributions.push({
        // The documented breakdown names the destination account; fall back to
        // the free-text description when a distribution has no target account.
        purpose:
          distribution.targetAccount?.name ||
          distribution.description ||
          'Unallocated',
        percentage: Number(distribution.percentage),
        amount,
      });
      summary.byCategory[category] = bucket;
    }

    summary.byGroup = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      amount: data.amount,
    }));

    return summary;
  }

  async getLocationSummary(
    locationId: number,
    startDate: string,
    endDate: string,
  ): Promise<LocationSummary> {
    const tenantId = this.tenantContext.requireTenant();

    // Get distributions to this location
    const distributions = await this.distributionRepository.find({
      where: {
        tenant: { id: tenantId },
        targetGroup: { id: locationId },
        createdAt: Between(...financeDayRangeTuple(startDate, endDate)),
      },
      relations: ['targetGroup'],
    });

    // Get matches associated with this location
    const matches = await this.matchRepository.find({
      where: {
        tenant: { id: tenantId },
        group: { id: locationId },
        status: MatchStatus.APPROVED,
      },
      relations: ['transaction', 'group'],
    });

    let totalReceived = 0;
    for (const match of matches) {
      if (
        match.transaction.transactionDate >= new Date(startDate) &&
        match.transaction.transactionDate <= new Date(endDate)
      ) {
        totalReceived += Number(match.transaction.amount);
      }
    }

    let totalDistributed = 0;
    const categoryMap = new Map<string, number>();

    for (const distribution of distributions) {
      const amount = Number(distribution.amount);
      totalDistributed += amount;

      const category = distribution.category || 'UNCATEGORIZED';
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    }

    const locationName =
      distributions[0]?.targetGroup?.name ||
      matches[0]?.group?.name ||
      'Unknown';

    return {
      locationId,
      locationName,
      totalReceived,
      totalDistributed,
      byCategory: Array.from(categoryMap.entries()).map(
        ([category, amount]) => ({
          category,
          amount,
        }),
      ),
    };
  }
}
