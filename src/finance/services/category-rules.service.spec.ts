import { Test, TestingModule } from '@nestjs/testing';
import { Connection, IsNull } from 'typeorm';
import { CategoryRulesService } from './category-rules.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import CategoryRule from '../entities/category-rule.entity';
import FinancialAccount from '../entities/financial-account.entity';
import Transaction from '../entities/transaction.entity';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { parseStatementDate } from '../finance-time';

/**
 * 2026-09-06 is a Sunday. Fixtures go through parseStatementDate so they are
 * built exactly as an imported row is — a Kampala wall-clock reading — rather
 * than in whatever zone the test host happens to run.
 */
const pad = (value: number) => String(value).padStart(2, '0');
const kampala = (day: string, hours = 0, minutes = 0) =>
  parseStatementDate(`${day} ${pad(hours)}:${pad(minutes)}`) as Date;
const sundayAt = (hours: number, minutes = 0) =>
  kampala('2026-09-06', hours, minutes);

describe('CategoryRulesService — rule matching', () => {
  let service: CategoryRulesService;
  let mockRepositories: any;

  beforeEach(async () => {
    mockRepositories = {
      rule: { find: jest.fn().mockResolvedValue([]) },
      account: { findOne: jest.fn() },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === CategoryRule) return mockRepositories.rule;
        if (entity === FinancialAccount) return mockRepositories.account;
        return {};
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryRulesService,
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

    service = module.get<CategoryRulesService>(CategoryRulesService);
  });

  const withRule = (
    conditions: any,
    category = TransactionCategory.OFFERING,
  ) => {
    mockRepositories.rule.find.mockResolvedValue([
      { id: 1, category, conditions, priority: 1, isActive: true },
    ]);
  };

  const categorize = (transaction: Partial<Transaction>, accountId?: number) =>
    service.categorizeTransaction(transaction as Transaction, accountId);

  describe('the documented Sunday morning offering rule', () => {
    const rule = {
      accounts: [1],
      daysOfWeek: [0],
      keywords: ['offering'],
      timeRange: { start: '08:00', end: '12:00' },
    };

    it('matches a Sunday mid-morning offering on the right account', async () => {
      withRule(rule);

      const result = await categorize(
        {
          transactionDate: sundayAt(9, 15),
          narration: 'Sunday offering',
          account: { id: 1 } as any,
        },
        1,
      );

      expect(result).toBe(TransactionCategory.OFFERING);
    });

    it('does not match outside the time window', async () => {
      withRule(rule);

      const result = await categorize(
        {
          transactionDate: sundayAt(14, 0),
          narration: 'Sunday offering',
          account: { id: 1 } as any,
        },
        1,
      );

      expect(result).toBeNull();
    });

    it('does not match on a weekday', async () => {
      withRule(rule);

      const result = await categorize(
        {
          // 2026-09-07 is the Monday after
          transactionDate: kampala('2026-09-07', 9, 15),
          narration: 'offering',
          account: { id: 1 } as any,
        },
        1,
      );

      expect(result).toBeNull();
    });

    it('does not match a different account', async () => {
      withRule(rule);

      const result = await categorize(
        {
          transactionDate: sundayAt(9, 15),
          narration: 'offering',
          account: { id: 2 } as any,
        },
        2,
      );

      expect(result).toBeNull();
    });
  });

  describe('keywords', () => {
    it('matches when any one keyword appears, in any searched field', async () => {
      withRule({ keywords: ['tithe', 'zaka'] });

      const result = await categorize({
        transactionDate: sundayAt(9),
        senderName: 'Jane',
        narration: 'monthly ZAKA payment',
      });

      expect(result).toBe(TransactionCategory.OFFERING);
    });

    it('does not match when no keyword appears', async () => {
      withRule({ keywords: ['tithe'] });

      const result = await categorize({
        transactionDate: sundayAt(9),
        narration: 'building fund',
      });

      expect(result).toBeNull();
    });
  });

  describe('dateRange', () => {
    it('matches inside a fixed window', async () => {
      withRule({ dateRange: { start: '2026-09-01', end: '2026-09-30' } });

      expect(await categorize({ transactionDate: sundayAt(9) })).toBe(
        TransactionCategory.OFFERING,
      );
    });

    it('applyEveryYear ignores the year', async () => {
      withRule({
        dateRange: { start: '2020-09-01', end: '2020-09-30' },
        applyEveryYear: true,
      });

      expect(await categorize({ transactionDate: sundayAt(9) })).toBe(
        TransactionCategory.OFFERING,
      );
    });

    it('applyEveryYear handles a window that wraps the new year', async () => {
      withRule({
        dateRange: { start: '2020-12-20', end: '2021-01-05' },
        applyEveryYear: true,
      });

      expect(await categorize({ transactionDate: kampala('2026-12-25') })).toBe(
        TransactionCategory.OFFERING,
      );
      expect(await categorize({ transactionDate: sundayAt(9) })).toBeNull();
    });
  });

  describe('safety', () => {
    it('never matches a rule with no conditions', async () => {
      withRule({});

      expect(await categorize({ transactionDate: sundayAt(9) })).toBeNull();
    });

    it('never matches an empty legacy condition array', async () => {
      withRule([]);

      expect(await categorize({ transactionDate: sundayAt(9) })).toBeNull();
    });

    it('still evaluates legacy field/operator/value rules', async () => {
      withRule([{ field: 'narration', operator: 'contains', value: 'tithe' }]);

      expect(
        await categorize({
          transactionDate: sundayAt(9),
          narration: 'MONTHLY TITHE',
        }),
      ).toBe(TransactionCategory.OFFERING);
      expect(
        await categorize({
          transactionDate: sundayAt(9),
          narration: 'offering',
        }),
      ).toBeNull();
    });
  });

  describe('rule lookup', () => {
    it('includes tenant-wide rules alongside account-scoped ones', async () => {
      await categorize({ transactionDate: sundayAt(9) }, 1);

      const where = mockRepositories.rule.find.mock.calls[0][0].where;
      expect(Array.isArray(where)).toBe(true);
      expect(where[0].account).toEqual({ id: 1 });
      // A builder rule leaves the relation null; it must not be filtered out
      expect(where[1].account).toEqual(IsNull());
    });
  });
});
