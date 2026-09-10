import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'typeorm';
import { ReportsService } from './reports.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Distribution from '../entities/distribution.entity';
import Group from '../../groups/entities/group.entity';
import { GroupCategoryPurpose } from '../../groups/enums/groups';
import { MatchStatus } from '../enums/match-status.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';

describe('ReportsService — CSV export', () => {
  let service: ReportsService;
  let mockRepositories: any;

  beforeEach(async () => {
    mockRepositories = {
      transaction: { find: jest.fn().mockResolvedValue([]) },
      match: { find: jest.fn() },
      distribution: { find: jest.fn().mockResolvedValue([]) },
      group: { findOne: jest.fn() },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Transaction) return mockRepositories.transaction;
        if (entity === ReconciliationMatch) return mockRepositories.match;
        if (entity === Distribution) return mockRepositories.distribution;
        if (entity === Group) return mockRepositories.group;
        return {};
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: 'CONNECTION', useValue: mockConnection },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
        {
          provide: AppLogger,
          useValue: {
            createContextLogger: jest.fn(() => ({
              business: jest.fn(),
              dataAccess: jest.fn(),
              security: jest.fn(),
              error: jest.fn(),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  const exportCsv = () =>
    service.exportReconciliationCsv('2026-09-01', '2026-09-30');

  it('emits a header row even with no transactions', async () => {
    const csv = await exportCsv();

    expect(csv.split('\n')[0]).toBe(
      'Date,Account,Amount,Category,Status,Sender Name,Sender Phone,Reference,Narration,Matched Contact',
    );
  });

  it('scopes the query to the tenant and the requested window', async () => {
    await exportCsv();

    const query = mockRepositories.transaction.find.mock.calls[0][0];
    expect(query.where.tenant).toEqual({ id: 1 });
    expect(query.where.transactionDate).toBeDefined();
    expect(query.order).toEqual({ transactionDate: 'ASC' });
  });

  it('names the contact from an approved match only', async () => {
    mockRepositories.transaction.find.mockResolvedValue([
      {
        transactionDate: new Date('2026-09-01T00:00:00.000Z'),
        account: { name: 'MTN' },
        amount: 5000,
        category: TransactionCategory.OFFERING,
        status: TransactionStatus.RECONCILED,
        senderName: 'Jane Doe',
        senderPhone: '0771234567',
        externalReference: 'REF1',
        narration: 'Sunday',
        matches: [
          {
            status: MatchStatus.APPROVED,
            contact: { person: { firstName: 'Jane', lastName: 'Doe' } },
          },
        ],
      },
      {
        transactionDate: new Date('2026-09-02T00:00:00.000Z'),
        account: { name: 'MTN' },
        amount: 6000,
        status: TransactionStatus.PENDING,
        senderName: 'John Roe',
        // A pending suggestion is not a reconciliation
        matches: [
          {
            status: MatchStatus.PENDING,
            contact: { person: { firstName: 'John', lastName: 'Roe' } },
          },
        ],
      },
    ]);

    const [, approved, pending] = (await exportCsv()).split('\n');

    expect(approved.endsWith('Jane Doe')).toBe(true);
    expect(pending.endsWith(',')).toBe(true);
  });

  it('escapes commas, quotes and newlines per RFC 4180', async () => {
    mockRepositories.transaction.find.mockResolvedValue([
      {
        transactionDate: new Date('2026-09-01T00:00:00.000Z'),
        account: { name: 'Bank, Main' },
        amount: 100,
        senderName: 'She said "hi"',
        narration: 'line one\nline two',
        matches: [],
      },
    ]);

    const row = (await exportCsv()).split('\n')[1];

    expect(row).toContain('"Bank, Main"');
    expect(row).toContain('"She said ""hi"""');
    expect(row).toContain('"line one');
  });

  describe('distributions by location', () => {
    // Zone 30 (structure) -> Location 20 (Kampala) -> Region 10 (structure)
    const tree: Record<number, any> = {
      30: {
        id: 30,
        name: 'Zone A',
        parentId: 20,
        category: { purpose: GroupCategoryPurpose.STRUCTURE },
      },
      20: {
        id: 20,
        name: 'Kampala',
        parentId: 10,
        category: { purpose: GroupCategoryPurpose.LOCATION },
      },
      10: {
        id: 10,
        name: 'Region',
        parentId: null,
        category: { purpose: GroupCategoryPurpose.STRUCTURE },
      },
    };

    beforeEach(() => {
      mockRepositories.group.findOne.mockImplementation(
        async ({ where }: any) => tree[where.id] ?? null,
      );
    });

    const distributionsFor = () =>
      service.getDistributionsByPeriod('2026-09-01', '2026-09-30');

    it('walks up the tree to the nearest location ancestor', async () => {
      mockRepositories.distribution.find.mockResolvedValue([
        {
          amount: 1000,
          percentage: 60,
          targetGroup: { id: 30 },
          targetAccount: { name: 'Missions' },
        },
      ]);

      const summary = await distributionsFor();

      expect(summary.byLocation).toEqual({ Kampala: 1000 });
    });

    it('reports groups above every location as Unallocated', async () => {
      mockRepositories.distribution.find.mockResolvedValue([
        { amount: 500, percentage: 10, targetGroup: { id: 10 } },
      ]);

      const summary = await distributionsFor();

      expect(summary.byLocation).toEqual({ Unallocated: 500 });
    });

    it('walks each tree only once across a report', async () => {
      mockRepositories.distribution.find.mockResolvedValue([
        { amount: 100, percentage: 10, targetGroup: { id: 30 } },
        { amount: 200, percentage: 20, targetGroup: { id: 30 } },
      ]);

      const summary = await distributionsFor();

      expect(summary.byLocation).toEqual({ Kampala: 300 });
      // Two distributions, one walk: 30 then 20, not four lookups
      expect(mockRepositories.group.findOne).toHaveBeenCalledTimes(2);
    });

    it('groups the breakdown by category with the destination account', async () => {
      mockRepositories.distribution.find.mockResolvedValue([
        {
          amount: 600,
          percentage: 60,
          category: 'TITHE',
          targetGroup: { id: 20 },
          targetAccount: { name: 'Central' },
        },
        {
          amount: 400,
          percentage: 40,
          category: 'TITHE',
          targetGroup: { id: 20 },
          description: 'Local fund',
        },
      ]);

      const summary = await distributionsFor();

      expect(summary.totalDistributed).toBe(1000);
      expect(summary.byCategory.TITHE.total).toBe(1000);
      expect(summary.byCategory.TITHE.distributions).toEqual([
        { purpose: 'Central', percentage: 60, amount: 600 },
        { purpose: 'Local fund', percentage: 40, amount: 400 },
      ]);
    });
  });

  it('renders the date as a plain day, not a timestamp', async () => {
    mockRepositories.transaction.find.mockResolvedValue([
      {
        transactionDate: new Date('2026-09-01T13:45:00.000Z'),
        account: { name: 'MTN' },
        amount: 100,
        matches: [],
      },
    ]);

    const row = (await exportCsv()).split('\n')[1];

    expect(row.startsWith('2026-09-01,MTN,100')).toBe(true);
  });
});
