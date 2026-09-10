import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { CategoryRulesService } from './category-rules.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { MatchType } from '../enums/match-type.enum';

const asUpload = (name: string, body: string): Express.Multer.File =>
  ({
    originalname: name,
    buffer: Buffer.from(body, 'utf-8'),
  }) as Express.Multer.File;

describe('TransactionsService — file import', () => {
  let service: TransactionsService;
  let mockRepositories: any;
  let mockCategoryRules: {
    categorizeTransaction: jest.Mock;
    matchTransaction: jest.Mock;
  };

  beforeEach(async () => {
    mockRepositories = {
      transaction: {
        save: jest.fn(async (t) => t),
        find: jest.fn().mockResolvedValue([]),
      },
      account: { findOne: jest.fn().mockResolvedValue({ id: 1 }) },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Transaction) return mockRepositories.transaction;
        if (entity === FinancialAccount) return mockRepositories.account;
        return {};
      }) as any,
    };

    mockCategoryRules = {
      categorizeTransaction: jest.fn(),
      matchTransaction: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
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
              startTracking: jest.fn(() => ({})),
              endTracking: jest.fn(),
            })),
          },
        },
        { provide: CategoryRulesService, useValue: mockCategoryRules },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  const parse = (file: Express.Multer.File, options: any = {}) =>
    service.parseFile(file, { accountId: 1, ...options }, { id: 1 });

  describe('parseFile — CSV', () => {
    // The reported bug: a .csv upload hit workbook.xlsx.load() and died with
    // "please upload a valid .xlsx file".
    it('reads a mobile money CSV without an xlsx error', async () => {
      const csv = [
        'Date,Amount,Sender Name,Phone Number,Reference',
        '2026-09-01,50000,Jane Doe,0771234567,REF001',
      ].join('\n');

      const result = await parse(asUpload('statement.csv', csv));

      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(true);
      expect(result[0].amount).toBe(50000);
      expect(result[0].senderName).toBe('Jane Doe');
      // "Phone Number" is detected even though the default is "Sender Phone",
      // and the leading zero survives — ExcelJS would otherwise read this
      // cell as the number 771234567 and break reconciliation matching.
      expect(result[0].senderPhone).toBe('0771234567');
      expect(result[0].externalReference).toBe('REF001');
    });

    it('detects the documented bank statement column names', async () => {
      const csv = [
        'Transaction Date,Amount,Account Name,Account Number,Description',
        '2026-09-02,120000,Church Account,0123456789,Sunday banking',
      ].join('\n');

      const result = await parse(asUpload('bank.csv', csv));

      expect(result[0].isValid).toBe(true);
      expect(result[0].senderName).toBe('Church Account');
      expect(result[0].narration).toBe('Sunday banking');
    });

    it('detects the documented cash collection column names', async () => {
      const csv = [
        'Date,Amount,Description,Notes',
        '2026-09-03,7500,Cash box,Counted twice',
      ].join('\n');

      const result = await parse(asUpload('cash.csv', csv));

      expect(result[0].isValid).toBe(true);
      expect(result[0].amount).toBe(7500);
      expect(result[0].narration).toBe('Cash box');
    });

    it('writes nothing to the database while parsing', async () => {
      await parse(asUpload('statement.csv', 'Date,Amount\n2026-09-01,1000'));

      expect(mockRepositories.transaction.save).not.toHaveBeenCalled();
    });
  });

  describe('parseFile — row validation', () => {
    it('flags bad rows instead of dropping them, and numbers them from the file', async () => {
      const csv = [
        'Date,Amount',
        '2026-09-01,1000',
        ',2000',
        '2026-09-03,not-a-number',
      ].join('\n');

      const result = await parse(asUpload('mixed.csv', csv));

      expect(result).toHaveLength(3);
      // Row 1 is the header, so the first data row is row 2
      expect(result.map((r) => r.rowIndex)).toEqual([2, 3, 4]);
      expect(result.map((r) => r.isValid)).toEqual([true, false, false]);
      expect(result[1].errors).toContain('Missing date');
      expect(result[2].errors).toContain('Invalid amount format');
    });
  });

  describe('parseFile — categorisation', () => {
    it('falls back to the default category when rules are off', async () => {
      const result = await parse(
        asUpload('statement.csv', 'Date,Amount\n2026-09-01,1000'),
        {
          defaultCategory: TransactionCategory.OFFERING,
          applyServiceTimeRules: false,
        },
      );

      expect(mockCategoryRules.matchTransaction).not.toHaveBeenCalled();
      expect(result[0].category).toBe(TransactionCategory.OFFERING);
      expect(result[0].matchedRule).toBe('Default category');
    });

    it('prefers a matched rule over the default category', async () => {
      mockCategoryRules.matchTransaction.mockResolvedValue({
        category: TransactionCategory.TITHE,
        rule: 'Sunday Morning Offering',
      });

      const result = await parse(
        asUpload('statement.csv', 'Date,Amount\n2026-09-01,1000'),
        {
          defaultCategory: TransactionCategory.OFFERING,
          applyServiceTimeRules: true,
        },
      );

      expect(result[0].category).toBe(TransactionCategory.TITHE);
      // The documented preview says *why* a row was categorised
      expect(result[0].matchedRule).toBe('Sunday Morning Offering');
    });

    it('falls back to the default when the rules engine matches nothing', async () => {
      mockCategoryRules.matchTransaction.mockResolvedValue(null);

      const result = await parse(
        asUpload('statement.csv', 'Date,Amount\n2026-09-01,1000'),
        {
          defaultCategory: TransactionCategory.DONATION,
          applyServiceTimeRules: true,
        },
      );

      expect(result[0].category).toBe(TransactionCategory.DONATION);
      expect(result[0].matchedRule).toBe('Default category');
    });
  });

  describe('parseFile — rejected files', () => {
    it('rejects legacy .xls with a message naming a supported format', async () => {
      await expect(parse(asUpload('old.xls', 'anything'))).rejects.toThrow(
        /Legacy .xls files are not supported/,
      );
    });

    it('rejects an empty upload', async () => {
      await expect(
        parse({ originalname: 'x.csv', buffer: Buffer.alloc(0) } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll — active match', () => {
    const listOne = async (matches: any[]) => {
      mockRepositories.transaction.find.mockResolvedValue([{ id: 1, matches }]);
      const [transaction] = await service.findAll({} as any);
      return (transaction as any).reconciliationMatch;
    };

    it('exposes the pending match so the screen can offer Approve', async () => {
      const match = await listOne([
        {
          id: 9,
          status: MatchStatus.PENDING,
          matchType: MatchType.MANUAL,
          confidenceScore: 100,
          contact: { id: 4, person: { firstName: 'Jane', lastName: 'Doe' } },
        },
      ]);

      expect(match).toEqual({
        id: 9,
        status: MatchStatus.PENDING,
        matchType: MatchType.MANUAL,
        confidenceScore: 100,
        contact: { id: 4, name: 'Jane Doe' },
      });
    });

    it('ignores rejected matches so the transaction can be matched again', async () => {
      const match = await listOne([
        { id: 9, status: MatchStatus.REJECTED, contact: null },
      ]);

      expect(match).toBeNull();
    });

    it('takes the most recent match when there is more than one', async () => {
      const match = await listOne([
        { id: 9, status: MatchStatus.PENDING, contact: null },
        { id: 12, status: MatchStatus.APPROVED, contact: null },
      ]);

      expect(match.id).toBe(12);
    });

    it('is null when nothing has been matched', async () => {
      expect(await listOne([])).toBeNull();
    });
  });

  describe('importParsed', () => {
    it('saves the reviewed rows and reports per-row failures', async () => {
      const result = await service.importParsed(
        {
          accountId: 1,
          transactions: [
            {
              rowIndex: 2,
              transactionDate: '2026-09-01T00:00:00.000Z',
              amount: 1000,
              category: TransactionCategory.OFFERING,
              isValid: true,
            },
            {
              rowIndex: 3,
              transactionDate: 'not-a-date',
              amount: 2000,
              isValid: false,
            },
          ],
        } as any,
        { id: 1 },
      );

      expect(result.imported).toBe(1);
      expect(result.errors).toEqual(['Row 3: Invalid date format']);
      expect(mockRepositories.transaction.save).toHaveBeenCalledTimes(1);
    });
  });
});
