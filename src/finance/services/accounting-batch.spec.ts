import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import FinancialAccount from '../entities/financial-account.entity';
import Contact from '../../crm/entities/contact.entity';
import {
  AccountingPosting,
  AccountingPostingStatus,
} from '../../integrations/quickbooks/entities/accounting-posting.entity';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { QuickBooksService } from '../../integrations/quickbooks/quickbooks.service';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { WorshipHarvestAccountingPlugin } from '../plugins/worship-harvest-accounting.plugin';
import { CategoryRoutingService } from './category-routing.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

/**
 * Posting a batch has to be all-or-each, never all-or-nothing: a receipt
 * QuickBooks rejects must not stop the gifts queued behind it, and whoever is
 * reading the result needs to know which giver failed — not a transaction id.
 */
describe('AccountingService — posting a batch', () => {
  let service: AccountingService;
  let repos: any;
  let plugin: { buildSalesReceipt: jest.Mock };
  let qbService: {
    getConnection: jest.Mock;
    postSalesReceipt: jest.Mock;
    getQboAccounts: jest.Mock;
  };
  let mapping: { lookupByInternal: jest.Mock; upsert: jest.Mock };

  /** A minimal sales receipt with every reference the payload guard requires. */
  const receipt = () => ({
    customer: { externalCustomerId: '1' },
    depositAccount: { externalAccountId: '2' },
    lineItems: [{ externalItemId: '3', amount: 2000, quantity: 1 }],
    transactionDate: '2026-09-06',
    referenceNumber: null,
    location: null,
    totalAmount: 2000,
    currency: 'UGX',
  });

  const transaction = (id: number, senderName: string, amount: number) => ({
    id,
    amount,
    transactionDate: new Date('2026-09-06T00:00:00.000Z'),
    senderName,
  });

  beforeEach(async () => {
    plugin = { buildSalesReceipt: jest.fn() };
    qbService = {
      getConnection: jest.fn(),
      postSalesReceipt: jest.fn(),
      getQboAccounts: jest.fn().mockResolvedValue([]),
    };
    mapping = { lookupByInternal: jest.fn(), upsert: jest.fn() };

    repos = {
      txn: { findOne: jest.fn() },
      match: { findOne: jest.fn().mockResolvedValue(null) },
      posting: {
        findOne: jest.fn(),
        create: jest.fn((row) => row),
        save: jest.fn(),
        query: jest.fn(),
      },
      contact: { findOne: jest.fn().mockResolvedValue(null) },
      account: { findOne: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: getRepositoryToken(Transaction), useValue: repos.txn },
        {
          provide: getRepositoryToken(ReconciliationMatch),
          useValue: repos.match,
        },
        {
          provide: getRepositoryToken(AccountingPosting),
          useValue: repos.posting,
        },
        { provide: getRepositoryToken(Contact), useValue: repos.contact },
        {
          provide: getRepositoryToken(FinancialAccount),
          useValue: repos.account,
        },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
        { provide: ExternalSystemMappingService, useValue: mapping },
        {
          provide: GroupPermissionsService,
          useValue: {
            resolveAttributionForContact: jest.fn(),
            resolveForContact: jest.fn(),
            getRootGroup: jest
              .fn()
              .mockResolvedValue({ id: 1, name: 'WH Global' }),
          },
        },
        { provide: QuickBooksService, useValue: qbService },
        { provide: WorshipHarvestAccountingPlugin, useValue: plugin },
        {
          // Nothing in these tests routes a category to a standing customer, so
          // every gift resolves to the giver — the behaviour that predates the
          // offertory work.
          provide: CategoryRoutingService,
          useValue: {
            isCurrencyRouted: jest.fn().mockReturnValue(false),
            resolveDepositAccount: jest
              .fn()
              .mockResolvedValue({ externalAccountId: null, currency: 'UGX' }),
            resolveGivingItem: jest.fn().mockResolvedValue({
              kind: 'giver',
              externalItemId: null,
              externalItemName: null,
              currency: 'UGX',
              configuredCurrencies: [],
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
  });

  it('posts every transaction even when one in the middle fails', async () => {
    repos.txn.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(
        transaction(
          where.id,
          { 1: 'Joshua Nabugere', 2: 'Elaine Ayikoru', 3: 'Patricia Nandera' }[
            where.id as 1 | 2 | 3
          ],
          where.id * 1000,
        ),
      ),
    );

    jest
      .spyOn(service, 'post')
      // Rejected by QuickBooks — a posting row exists, marked FAILED.
      .mockResolvedValueOnce({
        status: AccountingPostingStatus.FAILED,
        errorMessage: JSON.stringify({
          Fault: { Error: [{ Detail: 'Duplicate Document Number' }] },
        }),
      } as any)
      .mockResolvedValueOnce({
        status: AccountingPostingStatus.POSTED,
        externalDocumentNumber: '1037',
        externalDocumentId: '99',
      } as any)
      .mockResolvedValueOnce({
        status: AccountingPostingStatus.POSTED,
        externalDocumentNumber: '1038',
        externalDocumentId: '100',
      } as any);

    const result = await service.postMany([1, 2, 3], 7);

    // The queue was not abandoned at the first failure.
    expect(service.post).toHaveBeenCalledTimes(3);
    expect(result.posted).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(3);
  });

  it('names the giver on a failure rather than only its id', async () => {
    repos.txn.findOne.mockResolvedValue(
      transaction(1, 'Joshua Nabugere', 2000),
    );
    repos.match.findOne.mockResolvedValue({ contact: { id: 42 } });
    repos.contact.findOne.mockResolvedValue({
      id: 42,
      person: { firstName: 'Joshua', lastName: 'Nabugere' },
    });

    jest.spyOn(service, 'post').mockResolvedValue({
      status: AccountingPostingStatus.FAILED,
      errorMessage: JSON.stringify({
        Fault: { Error: [{ Detail: 'Duplicate Document Number' }] },
      }),
    } as any);

    const [failure] = (await service.postMany([1], 7)).results;

    expect(failure.giver).toBe('Joshua Nabugere');
    expect(failure.amount).toBe(2000);
    expect(failure.transactionDate).toBe('2026-09-06');
    // The raw QuickBooks fault JSON is unreadable; report the detail.
    expect(failure.error).toBe('Duplicate Document Number');
  });

  it('falls back to the name on the statement when no contact is matched', async () => {
    repos.txn.findOne.mockResolvedValue(
      transaction(5, 'Shammah Arinaitwe', 5000),
    );
    repos.match.findOne.mockResolvedValue(null);

    jest.spyOn(service, 'post').mockRejectedValue(
      new BadRequestException({
        message: 'Transaction is not ready to post',
        blockers: [
          { code: 'CUSTOMER_MAPPING_MISSING', message: 'No customer mapped' },
        ],
      }),
    );

    const [failure] = (await service.postMany([5], 7)).results;

    expect(failure.giver).toBe('Shammah Arinaitwe');
    expect(failure.status).toBe('FAILED');
    // Preflight blockers explain what to fix.
    expect(failure.error).toBe('No customer mapped');
  });

  it('still reports a row whose details cannot be read', async () => {
    repos.txn.findOne.mockRejectedValue(new Error('gone'));
    jest.spyOn(service, 'post').mockRejectedValue(new Error('boom'));

    const [failure] = (await service.postMany([404], 7)).results;

    expect(failure.transactionId).toBe(404);
    expect(failure.giver).toBe('Transaction 404');
    expect(failure.status).toBe('FAILED');
  });

  describe('claiming a transaction before posting', () => {
    beforeEach(() => {
      // preflight is exercised elsewhere; here the transaction is ready.
      jest
        .spyOn(service, 'preflight')
        .mockResolvedValue({ ready: true, blockers: [] });
      repos.txn.findOne.mockResolvedValue(
        transaction(1, 'Joshua Nabugere', 2000),
      );
      repos.match.findOne.mockResolvedValue({ contact: { id: 42 } });
    });

    it('refuses a transaction another request has already posted', async () => {
      // The conditional upsert returns no row when the existing one is POSTED.
      repos.posting.query.mockResolvedValue([]);
      repos.posting.findOne.mockResolvedValue({
        status: AccountingPostingStatus.POSTED,
      });

      await expect(service.post(1, 7)).rejects.toThrow(/already been posted/i);
      // Nothing may reach QuickBooks once the claim is refused.
      expect(plugin.buildSalesReceipt).not.toHaveBeenCalled();
    });

    it('refuses while another request still holds a live claim', async () => {
      // A PENDING row inside its lease also yields no claim.
      repos.posting.query.mockResolvedValue([]);
      repos.posting.findOne.mockResolvedValue({
        status: AccountingPostingStatus.PENDING,
      });

      await expect(service.post(1, 7)).rejects.toThrow(/already being posted/i);
      expect(plugin.buildSalesReceipt).not.toHaveBeenCalled();
    });

    it('only takes over a failed attempt or an expired lease', async () => {
      repos.posting.query.mockResolvedValue([
        { id: 9, status: AccountingPostingStatus.PENDING },
      ]);
      plugin.buildSalesReceipt.mockResolvedValue(receipt());
      qbService.postSalesReceipt.mockResolvedValue({ Id: '5', DocNumber: '1' });
      repos.posting.save.mockImplementation(async (row: any) => row);

      await service.post(1, 7);

      const [sql, params] = repos.posting.query.mock.calls[0];
      // A live PENDING row must not be reclaimable.
      expect(sql).not.toContain(`"status" <> 'POSTED'`);
      expect(sql).toContain(`"accounting_posting"."status" = 'FAILED'`);
      expect(sql).toContain(`"accounting_posting"."requestedAt" < now()`);
      // The lease length is passed as an interval rather than interpolated.
      expect(params).toContain('10 minutes');
    });

    it('claims the row with a conditional upsert, not a blind insert', async () => {
      repos.posting.query.mockResolvedValue([
        { id: 9, status: AccountingPostingStatus.PENDING },
      ]);
      plugin.buildSalesReceipt.mockResolvedValue(receipt());
      qbService.postSalesReceipt.mockResolvedValue({ Id: '5', DocNumber: '1' });
      repos.posting.save.mockImplementation(async (row: any) => row);

      await service.post(1, 7);

      const [sql] = repos.posting.query.mock.calls[0];
      // The insert itself is the claim: on conflict it updates conditionally
      // and returns nothing when it may not take over.
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
      expect(sql).toContain('RETURNING *');
    });
  });

  /**
   * A mapping outlives the dialog that created it, and every later lookup finds
   * it by the contact's numeric id. A row that names a contact which does not
   * exist, or names a real one in a spelling the lookup will not reproduce, is
   * a mapping nobody can use and nobody can see is broken.
   */
  describe('resolving the contact a mapping is keyed on', () => {
    const link = (internalReferenceId: string | number) => ({
      mappings: [
        {
          internalReferenceType: 'CONTACT',
          internalReferenceId,
          externalReferenceType: 'CUSTOMER',
          externalReferenceId: '77',
        },
      ],
    });

    beforeEach(() => {
      jest.spyOn(service, 'getSetup').mockResolvedValue({
        ready: true,
        missingMappings: [],
        dataIssues: [],
      });
    });

    it('refuses to link a contact that does not exist', async () => {
      repos.contact.findOne.mockResolvedValue(null);

      await expect(service.applySetup(1, link(4242) as any)).rejects.toThrow(
        /Contact 4242 was not found/,
      );
      // Nothing may be persisted against an id that names nobody.
      expect(mapping.upsert).not.toHaveBeenCalled();
    });

    it('refuses a reference that is not a contact id at all', async () => {
      await expect(service.applySetup(1, link('abc') as any)).rejects.toThrow(
        /not a valid contact reference/,
      );
      expect(repos.contact.findOne).not.toHaveBeenCalled();
      expect(mapping.upsert).not.toHaveBeenCalled();
    });

    it('stores the contact id in the spelling later lookups build', async () => {
      repos.contact.findOne.mockResolvedValue({ id: 1 });

      await service.applySetup(1, link('01') as any);

      expect(mapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ internalReferenceId: '1' }),
      );
    });
  });

  /**
   * A retry after an ambiguous outcome is the dangerous case: `withAuth` may
   * refresh and retry a 401 that QuickBooks had already accepted, and a request
   * that times out may have been accepted with the reply lost on the way back.
   * The idempotency key is what makes retrying those safe, so its stability is
   * worth pinning down — without it a member is credited twice and someone has
   * to void a receipt by hand.
   */
  describe('idempotency of a retried posting', () => {
    beforeEach(() => {
      repos.txn.findOne.mockResolvedValue(
        transaction(1, 'Joshua Nabugere', 2000),
      );
      repos.match.findOne.mockResolvedValue({ contact: { id: 42 } });
      repos.posting.query.mockResolvedValue([
        {
          status: AccountingPostingStatus.PENDING,
          errorMessage: null,
          externalDocumentId: null,
          externalDocumentNumber: null,
          postedAt: null,
        },
      ]);
      repos.posting.save.mockImplementation((row: any) => Promise.resolve(row));
      plugin.buildSalesReceipt.mockResolvedValue(receipt());
      jest
        .spyOn(service, 'preflight')
        .mockResolvedValue({ ready: true, blockers: [] });
    });

    it('sends the same key on every attempt at the same transaction', async () => {
      qbService.postSalesReceipt.mockResolvedValue({
        Id: '99',
        DocNumber: '1037',
      });

      await service.post(1, 7);
      await service.post(1, 7);

      const [firstKey, secondKey] = qbService.postSalesReceipt.mock.calls.map(
        (call: any[]) => call[2],
      );
      expect(firstKey).toBe(secondKey);
      expect(firstKey).toBeTruthy();
      // Intuit rejects anything longer.
      expect(firstKey.length).toBeLessThanOrEqual(50);
    });

    it('gives a different key to a different transaction', async () => {
      qbService.postSalesReceipt.mockResolvedValue({ Id: '99' });
      repos.txn.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(transaction(where.id, 'Joshua Nabugere', 2000)),
      );

      await service.post(1, 7);
      await service.post(2, 7);

      const [firstKey, secondKey] = qbService.postSalesReceipt.mock.calls.map(
        (call: any[]) => call[2],
      );
      expect(firstKey).not.toBe(secondKey);
    });

    it('records a refusal as failed, leaving it retryable', async () => {
      qbService.postSalesReceipt.mockRejectedValue({
        response: {
          status: 400,
          data: { Fault: { Error: [{ Detail: 'Duplicate Document Number' }] } },
        },
        message: 'Bad Request',
      });

      const posting = await service.post(1, 7);

      expect(posting.status).toBe(AccountingPostingStatus.FAILED);
    });

    it('records a timeout as failed too, since the key makes the retry safe', async () => {
      qbService.postSalesReceipt.mockRejectedValue(
        Object.assign(new Error('timeout of 30000ms exceeded'), {
          code: 'ECONNABORTED',
        }),
      );

      const posting = await service.post(1, 7);

      expect(posting.status).toBe(AccountingPostingStatus.FAILED);
      expect(posting.errorMessage).toMatch(/timeout/);
    });
  });

  describe('preflight for a collected offering', () => {
    beforeEach(() => {
      repos.txn.findOne.mockResolvedValue({
        id: 1,
        amount: 45000,
        category: 'OFFERING',
        senderName: 'Isaac Wakweyika',
        account: { id: 3, currency: 'UGX' },
      });
      repos.posting.findOne.mockResolvedValue(null);
      repos.match.findOne.mockResolvedValue(null);
      qbService.getConnection.mockResolvedValue({ id: 1 });
      mapping.lookupByInternal.mockResolvedValue({ externalReferenceId: 'x' });
    });

    it('does not ask for an approved match', async () => {
      const routing = (service as any).categoryRoutingService;
      routing.isCurrencyRouted.mockReturnValue(true);
      routing.resolveGivingItem.mockResolvedValue({
        kind: 'category',
        externalItemId: '91',
        externalItemName: 'Offertory UGX',
        currency: 'UGX',
        configuredCurrencies: ['UGX'],
      });

      const { blockers } = await service.preflight(1);
      const codes = blockers.map((b) => b.code);

      expect(codes).not.toContain('MATCH_NOT_APPROVED');
      expect(codes).not.toContain('CUSTOMER_MAPPING_MISSING');
    });

    it('asks for the item, not a giver, when the currency is unmapped', async () => {
      const routing = (service as any).categoryRoutingService;
      routing.isCurrencyRouted.mockReturnValue(true);
      routing.resolveGivingItem.mockResolvedValue({
        kind: 'unconfigured',
        externalItemId: null,
        externalItemName: null,
        currency: 'UGX',
        configuredCurrencies: [],
      });

      const { blockers } = await service.preflight(1);
      const codes = blockers.map((b) => b.code);

      expect(codes).toContain('CATEGORY_CURRENCY_ITEM_MISSING');
      expect(codes).not.toContain('MATCH_NOT_APPROVED');
      expect(codes).not.toContain('CUSTOMER_MAPPING_MISSING');
    });

    it('does not also demand the legacy category item mapping', async () => {
      const routing = (service as any).categoryRoutingService;
      routing.isCurrencyRouted.mockReturnValue(true);
      routing.resolveGivingItem.mockResolvedValue({
        kind: 'category',
        externalItemId: '31',
        externalItemName: 'Offertory UGX',
        currency: 'UGX',
        configuredCurrencies: ['UGX'],
      });
      // No GIVING_CATEGORY -> ITEM mapping anywhere.
      mapping.lookupByInternal.mockImplementation(({ internalReferenceType }) =>
        Promise.resolve(
          internalReferenceType === 'GIVING_CATEGORY'
            ? null
            : { externalReferenceId: 'x' },
        ),
      );

      const { blockers } = await service.preflight(1);

      expect(blockers.map((b) => b.code)).not.toContain('ITEM_MAPPING_MISSING');
    });

    it('still demands it for a gift that posts under its giver', async () => {
      mapping.lookupByInternal.mockImplementation(({ internalReferenceType }) =>
        Promise.resolve(
          internalReferenceType === 'GIVING_CATEGORY'
            ? null
            : { externalReferenceId: 'x' },
        ),
      );
      repos.match.findOne.mockResolvedValue({ contact: { id: 42 } });
      (
        service as any
      ).groupPermissionsService.resolveAttributionForContact.mockResolvedValue({
        location: { id: 1, name: 'WH Global' },
        fob: { id: 1, name: 'WH Global' },
        locationIsFallback: true,
        fobIsFallback: true,
      });

      const { blockers } = await service.preflight(1);

      expect(blockers.map((b) => b.code)).toContain('ITEM_MAPPING_MISSING');
    });

    it('still asks for a match on a gift that posts under its giver', async () => {
      const { blockers } = await service.preflight(1);

      expect(blockers.map((b) => b.code)).toContain('MATCH_NOT_APPROVED');
    });
  });

  describe('an offering deposit account QuickBooks will not accept', () => {
    beforeEach(() => {
      repos.txn.findOne.mockResolvedValue({
        id: 1,
        amount: 20000,
        category: 'OFFERING',
        senderName: 'Josephine Kyokunda',
        account: { id: 3, currency: 'UGX' },
      });
      repos.posting.findOne.mockResolvedValue(null);
      repos.match.findOne.mockResolvedValue(null);
      qbService.getConnection.mockResolvedValue({ id: 1 });
      mapping.lookupByInternal.mockResolvedValue({ externalReferenceId: 'x' });

      const routing = (service as any).categoryRoutingService;
      routing.isCurrencyRouted.mockReturnValue(true);
      routing.resolveGivingItem.mockResolvedValue({
        kind: 'category',
        externalItemId: '31',
        externalItemName: 'Offertory UGX',
        currency: 'UGX',
        configuredCurrencies: ['UGX'],
      });
      routing.resolveDepositAccount.mockResolvedValue({
        externalAccountId: '77',
        currency: 'UGX',
      });
      qbService.getQboAccounts.mockResolvedValue([
        { Id: '77', Name: 'YXP Offertory', AccountType: 'Income' },
        { Id: '12', Name: 'MoMo UGX', AccountType: 'Bank' },
      ]);
    });

    it('names the account and its type rather than leaving Intuit to refuse it', async () => {
      const { blockers } = await service.preflight(1);
      const blocker = blockers.find(
        (b) => b.code === 'CATEGORY_CURRENCY_DEPOSIT_INVALID',
      );

      expect(blocker?.message).toMatch(/YXP Offertory/);
      expect(blocker?.message).toMatch(/Income/);
    });

    it('refuses to save an income account as the deposit', async () => {
      repos.contact.findOne.mockResolvedValue({ id: 1 });

      await expect(
        service.applySetup(1, {
          mappings: [
            {
              internalReferenceType: 'CATEGORY_CURRENCY',
              internalReferenceId: 'OFFERING:UGX',
              externalReferenceType: 'ACCOUNT',
              externalReferenceId: '77',
            },
          ],
        } as any),
      ).rejects.toThrow(/Income account/);
    });
  });
});
