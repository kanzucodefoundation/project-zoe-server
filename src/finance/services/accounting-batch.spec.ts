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
import { TenantContext } from '../../shared/tenant/tenant-context';

/**
 * Posting a batch has to be all-or-each, never all-or-nothing: a receipt
 * QuickBooks rejects must not stop the gifts queued behind it, and whoever is
 * reading the result needs to know which giver failed — not a transaction id.
 */
describe('AccountingService — posting a batch', () => {
  let service: AccountingService;
  let repos: any;

  const transaction = (id: number, senderName: string, amount: number) => ({
    id,
    amount,
    transactionDate: new Date('2026-09-06T00:00:00.000Z'),
    senderName,
  });

  beforeEach(async () => {
    repos = {
      txn: { findOne: jest.fn() },
      match: { findOne: jest.fn().mockResolvedValue(null) },
      posting: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
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
        {
          provide: ExternalSystemMappingService,
          useValue: { lookupByInternal: jest.fn(), upsert: jest.fn() },
        },
        {
          provide: GroupPermissionsService,
          useValue: {
            resolveAttributionForContact: jest.fn(),
            resolveForContact: jest.fn(),
          },
        },
        { provide: QuickBooksService, useValue: { getConnection: jest.fn() } },
        {
          provide: WorshipHarvestAccountingPlugin,
          useValue: { buildSalesReceipt: jest.fn() },
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

    jest
      .spyOn(service, 'post')
      .mockRejectedValue(
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
});
