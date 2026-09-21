import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { CategoryRulesService } from './category-rules.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { GivingCategoriesService } from './giving-categories.service';
import { CategoryRoutingService } from './category-routing.service';

/**
 * End-to-end import checks against the two statement shapes Worship Harvest
 * actually receives, using rows copied from a real export.
 *
 * The point is column detection plus cleanup working together: these files
 * have no "Sender Name" or "Phone" column at all, and the giver's details are
 * spread across "From", "From name" and a free-text "To message".
 */

/** The twelve giving items from the church's production QuickBooks. */
const QBO_ITEMS = [
  { name: 'Tithes', category: TransactionCategory.TITHE },
  { name: "Offertory - Children's Church", category: null },
  { name: 'Offertory - Main Garage', category: TransactionCategory.OFFERING },
  { name: 'Offertory - Thanksgiving', category: null },
  { name: 'Offertory - YXP', category: null },
  { name: 'Firstfruits', category: null },
  { name: 'Arise and Build', category: TransactionCategory.ARISE_BUILD },
  { name: 'Products & Services', category: null },
  { name: 'Donations', category: TransactionCategory.DONATION },
  { name: 'Other Income', category: null },
  { name: 'Buy The Land', category: null },
  { name: 'Investment Income', category: null },
].map((item, index) => ({
  category: item.category,
  label: item.name,
  internalLabel: null,
  qboItemId: String(index + 1),
  qboItemName: item.name,
  selectable: true,
  isDefault: item.category === TransactionCategory.TITHE,
}));

const givingCategoriesMock = {
  list: jest.fn().mockResolvedValue(QBO_ITEMS),
};

const asUpload = (name: string, body: string): Express.Multer.File =>
  ({
    originalname: name,
    buffer: Buffer.from(body, 'utf-8'),
  }) as Express.Multer.File;

/** Statement with a "To message" column — the mobile-money merchant export. */
const WITH_MESSAGE = [
  'Date,From,From account,From name,To,To account,To name,To message,Currency,Amount',
  '06/09/2026 13:10,FRI:256763676927/MSISDN,FRI:204945451/MM,JOSHUA NABUGERE,FRI:256778618418/MSISDN,FRI:66209845/MM,WORSHIP HARVEST MINISTRIES LIMITED,WHARUAYXPOFFERTORY,UGX,"2,000"',
  '06/09/2026 10:06,FRI:256788069563/MSISDN,FRI:76683154/MM,Shammah Arinaitwe,FRI:256778618418/MSISDN,FRI:66209845/MM,WORSHIP HARVEST MINISTRIES LIMITED,Arua WH,UGX,"5,000"',
  '05/09/2026 09:40,FRI:256777176550/MSISDN,FRI:77922998/MM,ELAINE   KEZIAH AYIKORU,FRI:256778618418/MSISDN,FRI:66209845/MM,WORSHIP HARVEST MINISTRIES LIMITED,tbgb0095 tithe,UGX,"20,000"',
  '05/09/2026 19:33,FRI:256781855291/MSISDN,FRI:106404026/MM,ESTHER WASAGALI,FRI:256778618418/MSISDN,FRI:66209845/MM,WORSHIP HARVEST MINISTRIES LIMITED,TBGB0416(Imbazo),UGX,"18,000"',
  '06/09/2026 10:39,FRI:256777055569/MSISDN,FRI:117011078/MM,PATRICIA NANDERA,FRI:256778618418/MSISDN,FRI:66209845/MM,WORSHIP HARVEST MINISTRIES LIMITED,TBGB0148,UGX,"10,000"',
].join('\n');

/** Plain MoMo export: no message column at all. */
const WITHOUT_MESSAGE = [
  'Id,Date,From,From account,From name,Amount',
  '43302654004,06/09/2026 09:58,FRI:256795249268/MSISDN,FRI:214815493/MM,JOEL SEMPIJJA,"3,000"',
  '43306503710,06/09/2026 13:02,FRI:256788069563/MSISDN,FRI:76683154/MM,Shammah Arinaitwe,"7,500"',
  '43302413830,06/09/2026 09:45,FRI:256774510768/MSISDN,FRI:150774106/MM,RUTH UWIRINGIYE,"1,000"',
].join('\n');

describe('TransactionsService — real mobile-money statements', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Transaction) {
          return { save: jest.fn(async (t) => t), find: jest.fn() };
        }
        if (entity === FinancialAccount) {
          return { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
        }
        return {};
      }) as any,
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
        {
          provide: CategoryRulesService,
          useValue: {
            categorizeTransaction: jest.fn(),
            matchTransaction: jest.fn().mockResolvedValue(null),
            loadRulesForAccount: jest.fn().mockResolvedValue([]),
            evaluateWithRules: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: CategoryRoutingService,
          useValue: { isCurrencyRouted: jest.fn().mockReturnValue(false) },
        },
        {
          provide: GivingCategoriesService,
          useValue: givingCategoriesMock,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  const parseWithMessage = () =>
    service.parseFile(
      asUpload('statement.csv', WITH_MESSAGE),
      { accountId: 1, applyServiceTimeRules: false } as any,
      { id: 1 },
    );

  describe('statement carrying a "To message"', () => {
    it('reads every row as valid', async () => {
      const rows = await parseWithMessage();
      expect(rows).toHaveLength(5);
      expect(rows.every((r) => r.isValid)).toBe(true);
    });

    it('takes the sender from "From name", not the FRI in "From"', async () => {
      const rows = await parseWithMessage();
      expect(rows.map((r) => r.senderName)).toEqual([
        'Joshua Nabugere',
        'Shammah Arinaitwe',
        'Elaine Keziah Ayikoru',
        'Esther Wasagali',
        'Patricia Nandera',
      ]);
    });

    it('recovers the MSISDN out of the FRI identifier', async () => {
      const rows = await parseWithMessage();
      expect(rows[0].senderPhone).toBe('256763676927');
      expect(rows[4].senderPhone).toBe('256777055569');
    });

    it('parses day-first dates and comma-grouped amounts', async () => {
      const rows = await parseWithMessage();
      expect(rows[0].amount).toBe(2000);
      expect(rows[2].amount).toBe(20000);
      // 06/09/2026 is 6 September, not 9 June.
      expect(new Date(rows[0].transactionDate).getUTCMonth()).toBe(8);
    });

    it('infers the category from the message and defaults the rest to tithe', async () => {
      const rows = await parseWithMessage();
      expect(rows.map((r) => r.category)).toEqual([
        TransactionCategory.OFFERING, // WHARUAYXPOFFERTORY
        TransactionCategory.TITHE, // "Arua WH" names no category
        TransactionCategory.TITHE, // "tbgb0095 tithe"
        TransactionCategory.TITHE, // "TBGB0416(Imbazo)"
        TransactionCategory.TITHE, // "TBGB0148"
      ]);
      // Row 0 names a specific QuickBooks item, so it says which one.
      expect(rows[0].matchedRule).toBe(
        'Matched "Offertory - YXP" in the statement message',
      );
      expect(rows[1].matchedRule).toBe('Default category');
    });

    it('books each row against the QuickBooks item the message names', async () => {
      const rows = await parseWithMessage();
      // A message naming an item books against it; the rest fall back to the
      // item for the category they resolved to, never to nothing.
      expect(rows.map((r) => r.externalItemName)).toEqual([
        'Offertory - YXP', // WHARUAYXPOFFERTORY — not just "an offering"
        'Tithes', // "Arua WH" names no item, so its category's item
        'Tithes', // "tbgb0095 tithe"
        'Tithes', // "TBGB0416(Imbazo)"
        'Tithes', // "TBGB0148"
      ]);
      expect(rows[0].matchedRule).toBe(
        'Matched "Offertory - YXP" in the statement message',
      );
    });

    it('pulls the tithe number out of the message', async () => {
      const rows = await parseWithMessage();
      expect(rows.map((r) => r.titheNumber)).toEqual([
        null,
        null,
        'TBGB0095',
        'TBGB0416',
        'TBGB0148',
      ]);
    });
  });

  describe('plain MoMo export with no message column', () => {
    it('still imports, defaulting every row to tithe', async () => {
      const rows = await service.parseFile(
        asUpload('momo.csv', WITHOUT_MESSAGE),
        { accountId: 1, applyServiceTimeRules: false } as any,
        { id: 1 },
      );

      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.isValid)).toBe(true);
      expect(rows.every((r) => r.category === TransactionCategory.TITHE)).toBe(
        true,
      );
      expect(rows.map((r) => r.senderName)).toEqual([
        'Joel Sempijja',
        'Shammah Arinaitwe',
        'Ruth Uwiringiye',
      ]);
      expect(rows[0].senderPhone).toBe('256795249268');
      // The "Id" column is the statement's own reference.
      expect(rows[0].externalReference).toBe('43302654004');
    });
  });

  describe('categories other than tithe', () => {
    const MIXED = [
      'Date,Amount,From name,To message',
      '06/09/2026,10000,ALICE A,offering for sunday',
      '06/09/2026,20000,BOB B,arise and build',
      '06/09/2026,30000,CAROL C,donation for missions',
      '06/09/2026,40000,DAN D,WHARUAYXPOFFERTORY',
      '06/09/2026,50000,ERIC E,tbgb0095 tithe',
    ].join(String.fromCharCode(10));

    const parseMixed = (options: Record<string, unknown> = {}) =>
      service.parseFile(
        asUpload('mixed.csv', MIXED),
        { accountId: 1, applyServiceTimeRules: false, ...options } as any,
        { id: 1 },
      );

    it('reads each giving type out of the message', async () => {
      const rows = await parseMixed();

      expect(rows.map((r) => r.category)).toEqual([
        'OFFERING',
        'ARISE_BUILD',
        'DONATION',
        'OFFERING',
        'TITHE',
      ]);
    });

    it('books each row against the item for its own category', async () => {
      givingCategoriesMock.list.mockResolvedValue([
        {
          category: 'TITHE',
          label: 'Tithe',
          internalLabel: 'Tithe',
          qboItemId: '24',
          qboItemName: 'Tithe',
          selectable: true,
          isDefault: true,
        },
        {
          category: 'OFFERING',
          label: 'Offertory UGX',
          internalLabel: 'Offering',
          qboItemId: '31',
          qboItemName: 'Offertory UGX',
          selectable: true,
          isDefault: false,
        },
      ]);

      const rows = await parseMixed({
        defaultItemId: '24',
        defaultItemName: 'Tithe',
      });

      // "offering for sunday" names no item, so it takes the offering item
      // rather than the wizard's default of Tithe.
      expect(rows[0].category).toBe('OFFERING');
      expect(rows[0].externalItemId).toBe('31');
      expect(rows[4].externalItemId).toBe('24');
    });
  });
});
