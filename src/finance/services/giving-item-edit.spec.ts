import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { GivingCategoriesService } from './giving-categories.service';
import { CategoryRoutingService } from './category-routing.service';
import { CategoryRulesService } from './category-rules.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { AccountingPostingStatus } from '../../integrations/quickbooks/entities/accounting-posting.entity';

describe('TransactionsService — correcting the giving item', () => {
  let service: TransactionsService;
  let repos: any;
  let givingCategories: { resolveGivingItem: jest.Mock };

  const transaction = (id: number, over: Record<string, any> = {}) => ({
    id,
    category: TransactionCategory.TITHE,
    externalItemId: '42',
    externalItemName: 'Tithe',
    ...over,
  });

  beforeEach(async () => {
    givingCategories = { resolveGivingItem: jest.fn() };

    repos = {
      transaction: {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn((entity: any) => Promise.resolve(entity)),
      },
      account: { findOne: jest.fn() },
      posting: { find: jest.fn().mockResolvedValue([]) },
    };

    const connection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        const name = entity?.name ?? '';
        if (name === 'FinancialAccount') return repos.account;
        if (name === 'AccountingPosting') return repos.posting;
        return repos.transaction;
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: 'CONNECTION', useValue: connection },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
        {
          provide: AppLogger,
          useValue: {
            createContextLogger: jest.fn().mockReturnValue({
              business: jest.fn(),
              error: jest.fn(),
              dataAccess: jest.fn(),
              startTracking: jest.fn(),
              endTracking: jest.fn(),
            }),
          },
        },
        { provide: CategoryRulesService, useValue: { apply: jest.fn() } },
        {
          provide: CategoryRoutingService,
          useValue: { isCurrencyRouted: jest.fn().mockReturnValue(false) },
        },
        { provide: GivingCategoriesService, useValue: givingCategories },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  describe('single row', () => {
    it('writes the item, its name and the category it implies', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      givingCategories.resolveGivingItem.mockResolvedValue({
        externalItemId: '77',
        externalItemName: 'Offertory - YXP',
        category: TransactionCategory.OFFERING,
      });

      const saved = await service.update(
        { id: 1, externalItemId: '77' } as any,
        { id: 9 },
      );

      expect(saved.externalItemId).toBe('77');
      expect(saved.externalItemName).toBe('Offertory - YXP');
      expect(saved.category).toBe(TransactionCategory.OFFERING);
    });

    it('lets the item decide the category when a request sends both', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      givingCategories.resolveGivingItem.mockResolvedValue({
        externalItemId: '77',
        externalItemName: 'Offertory - YXP',
        category: TransactionCategory.OFFERING,
      });

      const saved = await service.update(
        {
          id: 1,
          category: TransactionCategory.DONATION,
          externalItemId: '77',
        } as any,
        { id: 9 },
      );

      expect(saved.category).toBe(TransactionCategory.OFFERING);
    });

    it('clears the item when null is sent, falling back to the category mapping', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      givingCategories.resolveGivingItem.mockResolvedValue({
        externalItemId: null,
        externalItemName: null,
        category: TransactionCategory.TITHE,
      });

      const saved = await service.update(
        { id: 1, externalItemId: null } as any,
        { id: 9 },
      );

      expect(saved.externalItemId).toBeNull();
      expect(saved.externalItemName).toBeNull();
    });

    it('leaves the item alone when the request does not mention it', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));

      const saved = await service.update(
        { id: 1, narration: 'corrected note' } as any,
        { id: 9 },
      );

      expect(givingCategories.resolveGivingItem).not.toHaveBeenCalled();
      expect(saved.externalItemId).toBe('42');
    });

    it('refuses a category-only change once the gift is in QuickBooks', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      repos.posting.find.mockResolvedValue([
        { transactionId: 1, status: AccountingPostingStatus.POSTED },
      ]);

      await expect(
        service.update(
          { id: 1, category: TransactionCategory.OFFERING } as any,
          { id: 9 },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('still allows unrelated edits on a posted gift', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      repos.posting.find.mockResolvedValue([
        { transactionId: 1, status: AccountingPostingStatus.POSTED },
      ]);

      const saved = await service.update(
        { id: 1, narration: 'corrected note' } as any,
        { id: 9 },
      );

      expect(saved.narration).toBe('corrected note');
    });

    it('refuses once the gift is in QuickBooks', async () => {
      repos.transaction.findOne.mockResolvedValue(transaction(1));
      repos.posting.find.mockResolvedValue([
        { transactionId: 1, status: AccountingPostingStatus.POSTED },
      ]);

      await expect(
        service.update({ id: 1, externalItemId: '77' } as any, { id: 9 }),
      ).rejects.toThrow(BadRequestException);
      expect(givingCategories.resolveGivingItem).not.toHaveBeenCalled();
    });
  });

  describe('in bulk', () => {
    it('applies one item to every row and looks it up once', async () => {
      repos.transaction.find.mockResolvedValue([
        transaction(1),
        transaction(2),
        transaction(3),
      ]);
      givingCategories.resolveGivingItem.mockResolvedValue({
        externalItemId: '77',
        externalItemName: 'Offertory - YXP',
        category: TransactionCategory.OFFERING,
      });

      const result = await service.bulkUpdateGivingItem(
        { transactionIds: [1, 2, 3], externalItemId: '77' } as any,
        { id: 9 },
      );

      expect(result.updated).toBe(3);
      // One lookup for the whole sweep, not one per row.
      expect(givingCategories.resolveGivingItem).toHaveBeenCalledTimes(1);
      const saved = repos.transaction.save.mock.calls[0][0];
      expect(saved.every((t: any) => t.externalItemId === '77')).toBe(true);
    });

    it('names ids it could not find rather than silently skipping them', async () => {
      repos.transaction.find.mockResolvedValue([transaction(1)]);

      await expect(
        service.bulkUpdateGivingItem(
          { transactionIds: [1, 2, 3], externalItemId: '77' } as any,
          { id: 9 },
        ),
      ).rejects.toThrow(/2, 3/);
      expect(repos.transaction.save).not.toHaveBeenCalled();
    });

    it('changes nothing when any row in the set is already posted', async () => {
      repos.transaction.find.mockResolvedValue([
        transaction(1),
        transaction(2),
      ]);
      repos.posting.find.mockResolvedValue([
        { transactionId: 2, status: AccountingPostingStatus.POSTED },
      ]);

      await expect(
        service.bulkUpdateGivingItem(
          { transactionIds: [1, 2], externalItemId: '77' } as any,
          { id: 9 },
        ),
      ).rejects.toThrow(/2/);
      expect(repos.transaction.save).not.toHaveBeenCalled();
    });

    it('de-duplicates repeated ids so a row is not counted twice', async () => {
      repos.transaction.find.mockResolvedValue([transaction(1)]);
      givingCategories.resolveGivingItem.mockResolvedValue({
        externalItemId: '77',
        externalItemName: 'Offertory - YXP',
        category: TransactionCategory.OFFERING,
      });

      const result = await service.bulkUpdateGivingItem(
        { transactionIds: [1, 1, 1], externalItemId: '77' } as any,
        { id: 9 },
      );

      expect(result.updated).toBe(1);
    });
  });
});
