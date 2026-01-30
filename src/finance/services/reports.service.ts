import { Injectable, Inject } from '@nestjs/common';
import { Repository, Connection, Between } from 'typeorm';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Distribution from '../entities/distribution.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
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
  byGroup: {
    groupId: number;
    groupName: string;
    amount: number;
  }[];
  byCategory: {
    category: string;
    amount: number;
  }[];
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

@Injectable()
export class ReportsService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly matchRepository: Repository<ReconciliationMatch>;
  private readonly distributionRepository: Repository<Distribution>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.transactionRepository = connection.getRepository(Transaction);
    this.matchRepository = connection.getRepository(ReconciliationMatch);
    this.distributionRepository = connection.getRepository(Distribution);
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
      transactionDate: Between(new Date(startDate), new Date(endDate)),
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

  async getDistributionsByPeriod(
    startDate: string,
    endDate: string,
  ): Promise<DistributionSummary> {
    const tenantId = this.tenantContext.requireTenant();

    const distributions = await this.distributionRepository.find({
      where: {
        tenant: { id: tenantId },
        createdAt: Between(new Date(startDate), new Date(endDate)),
      },
      relations: ['targetGroup', 'targetAccount'],
    });

    const summary: DistributionSummary = {
      totalDistributed: 0,
      byGroup: [],
      byCategory: [],
    };

    const groupMap = new Map<
      number,
      { groupName: string; amount: number }
    >();
    const categoryMap = new Map<string, number>();

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

      const category = distribution.category || 'UNCATEGORIZED';
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    }

    summary.byGroup = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      amount: data.amount,
    }));

    summary.byCategory = Array.from(categoryMap.entries()).map(
      ([category, amount]) => ({
        category,
        amount,
      }),
    );

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
        createdAt: Between(new Date(startDate), new Date(endDate)),
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
