import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { DistributionsService } from './distributions.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';
import Distribution from '../entities/distribution.entity';
import DistributionBatch from '../entities/distribution-batch.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import FinancialAccount from '../entities/financial-account.entity';
import Group from '../../groups/entities/group.entity';
import { BatchStatus } from '../enums/batch-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';

describe('DistributionsService', () => {
  let service: DistributionsService;
  let mockRepositories: any;
  let mockPlugin: { calculateDistributions: jest.Mock };

  beforeEach(async () => {
    mockRepositories = {
      distribution: { save: jest.fn(async (d) => ({ ...d, id: 1 })) },
      batch: {
        // Batch creation hands back an id the calculation then loads
        save: jest.fn(async (b) => ({ ...b, id: b.id ?? 99 })),
        findOne: jest.fn(),
      },
      match: { find: jest.fn().mockResolvedValue([]) },
      account: { findOne: jest.fn() },
      group: { findOne: jest.fn() },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Distribution) return mockRepositories.distribution;
        if (entity === DistributionBatch) return mockRepositories.batch;
        if (entity === ReconciliationMatch) return mockRepositories.match;
        if (entity === FinancialAccount) return mockRepositories.account;
        if (entity === Group) return mockRepositories.group;
        return {};
      }) as any,
    };

    mockPlugin = { calculateDistributions: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributionsService,
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
        {
          provide: ReconciliationPluginRegistry,
          useValue: {
            get: jest.fn(() => mockPlugin),
            getDefault: jest.fn(() => mockPlugin),
          },
        },
      ],
    }).compile();

    service = module.get<DistributionsService>(DistributionsService);
  });

  const approvedMatch = (id: number, amount = 1000) => ({
    id,
    status: MatchStatus.APPROVED,
    transaction: {
      id: id * 10,
      amount,
      category: TransactionCategory.TITHE,
      transactionDate: new Date('2026-09-06T06:15:00.000Z'),
    },
  });

  describe('calculateDistributions — period form', () => {
    // What the Distributions screen sends: a name and a date range.
    const periodRequest = {
      name: 'September tithes',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      includeApprovedOnly: true,
    };

    it('creates a draft batch for the period', async () => {
      mockRepositories.match.find.mockResolvedValue([approvedMatch(5)]);
      mockRepositories.batch.findOne.mockResolvedValue({ id: 99 });

      await service.calculateDistributions(periodRequest, undefined, { id: 7 });

      const created = mockRepositories.batch.save.mock.calls[0][0];
      expect(created.name).toBe('September tithes');
      expect(created.status).toBe(BatchStatus.DRAFT);
      // Finance-zone boundaries: 2026-09-01 00:00 EAT = 2026-08-31T21:00:00Z,
      // 2026-09-30 23:59:59.999 EAT = 2026-09-30T20:59:59.999Z.
      expect(created.periodStart).toEqual(new Date('2026-08-31T21:00:00.000Z'));
      expect(created.periodEnd).toEqual(new Date('2026-09-30T20:59:59.999Z'));
    });

    it('scopes the period lookup to the tenant and the whole window', async () => {
      mockRepositories.match.find.mockResolvedValue([approvedMatch(5)]);
      mockRepositories.batch.findOne.mockResolvedValue({ id: 99 });

      await service.calculateDistributions(periodRequest, undefined, { id: 7 });

      // The period lookup deliberately fetches every status, so an empty
      // result can distinguish "nothing here" from "nothing approved".
      const where = mockRepositories.match.find.mock.calls[0][0].where;
      expect(where.status).toBeUndefined();
      expect(where.tenant).toEqual({ id: 1 });
      expect(where.transaction.transactionDate).toBeDefined();
    });

    it('distributes only the approved matches it found', async () => {
      mockRepositories.match.find.mockResolvedValue([
        approvedMatch(5),
        { id: 6, status: MatchStatus.PENDING, transaction: { id: 60 } },
      ]);
      mockRepositories.batch.findOne.mockResolvedValue({ id: 99 });

      await service.calculateDistributions(periodRequest, undefined, { id: 7 });

      // Second call is the main fetch, narrowed to the approved ids
      const second = mockRepositories.match.find.mock.calls[1][0].where;
      expect(second.status).toBe(MatchStatus.APPROVED);
    });

    it('refuses an empty period and says nothing is matched yet', async () => {
      mockRepositories.match.find.mockResolvedValue([]);

      await expect(
        service.calculateDistributions(periodRequest, undefined, { id: 7 }),
      ).rejects.toThrow(/No matched transactions between/);

      expect(mockRepositories.batch.save).not.toHaveBeenCalled();
    });

    it('points at the approval queue when matches exist but none are approved', async () => {
      mockRepositories.match.find.mockResolvedValue([
        { id: 6, status: MatchStatus.PENDING, transaction: { id: 60 } },
        { id: 7, status: MatchStatus.PENDING, transaction: { id: 70 } },
      ]);

      await expect(
        service.calculateDistributions(periodRequest, undefined, { id: 7 }),
      ).rejects.toThrow(/2 match\(es\) there are still awaiting approval/);

      expect(mockRepositories.batch.save).not.toHaveBeenCalled();
    });

    it('refuses a request carrying neither matchIds nor a period', async () => {
      await expect(
        service.calculateDistributions({ name: 'Nothing' } as any, undefined, {
          id: 7,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepositories.batch.save).not.toHaveBeenCalled();
    });
  });

  describe('calculateDistributions — matchIds form', () => {
    it('still works and does not invent a batch', async () => {
      mockRepositories.match.find.mockResolvedValue([approvedMatch(5)]);

      await service.calculateDistributions({ matchIds: [5] }, undefined, {
        id: 7,
      });

      expect(mockRepositories.batch.save).not.toHaveBeenCalled();
      expect(mockRepositories.match.find.mock.calls[0][0].where.status).toBe(
        MatchStatus.APPROVED,
      );
    });
  });

  describe('submitBatch', () => {
    it('moves a draft into the approval queue', async () => {
      mockRepositories.batch.findOne.mockResolvedValue({
        id: 3,
        status: BatchStatus.DRAFT,
      });

      const result = await service.submitBatch(3, { id: 7 });

      expect(result.status).toBe(BatchStatus.PENDING_APPROVAL);
    });

    it('refuses a batch that is not a draft', async () => {
      mockRepositories.batch.findOne.mockResolvedValue({
        id: 3,
        status: BatchStatus.EXECUTED,
      });

      await expect(service.submitBatch(3, { id: 7 })).rejects.toThrow(
        /Only a draft batch can be submitted/,
      );
      expect(mockRepositories.batch.save).not.toHaveBeenCalled();
    });

    it('404s for a batch outside the tenant', async () => {
      mockRepositories.batch.findOne.mockResolvedValue(null);

      await expect(service.submitBatch(3, { id: 7 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
