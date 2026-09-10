import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { ReconciliationService } from './reconciliation.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Transaction from '../entities/transaction.entity';
import Contact from '../../crm/entities/contact.entity';
import Group from '../../groups/entities/group.entity';
import { MatchStatus } from '../enums/match-status.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';

describe('ReconciliationService — transaction-scoped status', () => {
  let service: ReconciliationService;
  let mockRepositories: any;

  beforeEach(async () => {
    mockRepositories = {
      match: {
        findOne: jest.fn(),
        save: jest.fn(async (m) => m),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { save: jest.fn(async (t) => t) },
      contact: { findOne: jest.fn() },
      group: { findOne: jest.fn() },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === ReconciliationMatch) return mockRepositories.match;
        if (entity === Transaction) return mockRepositories.transaction;
        if (entity === Contact) return mockRepositories.contact;
        if (entity === Group) return mockRepositories.group;
        return {};
      }) as any,
      // Simulate the transaction callback. count delegates to the match repo
      // mock (so tests can control it via mockResolvedValue); save routes by
      // entity — Transaction goes to the transaction repo mock, ReconciliationMatch
      // is returned as-is (the match object already has the mutations applied).
      transaction: jest.fn(async (cb: (manager: any) => Promise<any>) =>
        cb({
          findOne: jest.fn().mockResolvedValue(null),
          count: jest.fn(async () => mockRepositories.match.count()),
          save: jest.fn(async (entity: any, data: any) => {
            if (entity === Transaction) {
              return mockRepositories.transaction.save(data);
            }
            return data;
          }),
        }),
      ) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
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

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  it('resolves the transaction to its match, newest first', async () => {
    mockRepositories.match.findOne.mockResolvedValue({
      id: 55,
      transaction: { id: 7, status: TransactionStatus.PENDING },
    });

    await service.setStatusForTransaction(7, MatchStatus.APPROVED, { id: 1 });

    expect(mockRepositories.match.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transaction: { id: 7 }, tenant: { id: 1 } },
        order: { id: 'DESC' },
      }),
    );
  });

  it('approving marks the transaction reconciled', async () => {
    const transaction = { id: 7, status: TransactionStatus.PENDING };
    mockRepositories.match.findOne.mockResolvedValue({ id: 55, transaction });

    const result = await service.setStatusForTransaction(
      7,
      MatchStatus.APPROVED,
      { id: 1 },
    );

    expect(result.status).toBe(MatchStatus.APPROVED);
    expect(result.approvedAt).toBeInstanceOf(Date);
    expect(transaction.status).toBe(TransactionStatus.RECONCILED);
    expect(mockRepositories.transaction.save).toHaveBeenCalledWith(transaction);
  });

  it('rejecting leaves the transaction unreconciled', async () => {
    const transaction = { id: 7, status: TransactionStatus.PENDING };
    mockRepositories.match.findOne.mockResolvedValue({ id: 55, transaction });

    const result = await service.setStatusForTransaction(
      7,
      MatchStatus.REJECTED,
      { id: 1 },
    );

    expect(result.status).toBe(MatchStatus.REJECTED);
    expect(transaction.status).toBe(TransactionStatus.PENDING);
    expect(mockRepositories.transaction.save).not.toHaveBeenCalled();
  });

  it('rejecting the only approved match reverts the transaction to PENDING', async () => {
    const transaction = { id: 7, status: TransactionStatus.RECONCILED };
    mockRepositories.match.findOne.mockResolvedValue({
      id: 55,
      transaction,
      approvedBy: { id: 1 },
      approvedAt: new Date(),
    });
    // No other approved match exists
    mockRepositories.match.count.mockResolvedValue(0);

    const result = await service.setStatusForTransaction(
      7,
      MatchStatus.REJECTED,
      { id: 1 },
    );

    expect(result.status).toBe(MatchStatus.REJECTED);
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
    expect(transaction.status).toBe(TransactionStatus.PENDING);
  });

  it('rejecting when another approved match exists keeps the transaction RECONCILED', async () => {
    const transaction = { id: 7, status: TransactionStatus.RECONCILED };
    mockRepositories.match.findOne.mockResolvedValue({
      id: 55,
      transaction,
      approvedBy: { id: 1 },
      approvedAt: new Date(),
    });
    // Another approved match still exists
    mockRepositories.match.count.mockResolvedValue(1);

    const result = await service.setStatusForTransaction(
      7,
      MatchStatus.REJECTED,
      { id: 1 },
    );

    expect(result.status).toBe(MatchStatus.REJECTED);
    // Thread 11: approval metadata cleared even when transaction stays RECONCILED
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
    expect(transaction.status).toBe(TransactionStatus.RECONCILED);
  });

  it('404s when the transaction has no match to act on', async () => {
    mockRepositories.match.findOne.mockResolvedValue(null);

    await expect(
      service.setStatusForTransaction(7, MatchStatus.APPROVED, { id: 1 }),
    ).rejects.toThrow(NotFoundException);

    expect(mockRepositories.match.save).not.toHaveBeenCalled();
  });
});
