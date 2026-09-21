import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorshipHarvestAccountingPlugin } from './worship-harvest-accounting.plugin';
import Contact from '../../crm/entities/contact.entity';
import FinancialAccount from '../entities/financial-account.entity';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { CategoryRoutingService } from '../services/category-routing.service';
import { TransactionCategory } from '../enums/transaction-category.enum';

describe('WorshipHarvestAccountingPlugin — who the receipt is booked to', () => {
  let plugin: WorshipHarvestAccountingPlugin;
  let routing: {
    isCurrencyRouted: jest.Mock;
    resolveGivingItem: jest.Mock;
    resolveDepositAccount: jest.Mock;
  };
  let mapping: { lookupByInternal: jest.Mock };

  const transaction = (category: TransactionCategory) =>
    ({
      id: 1,
      amount: 50000,
      transactionDate: new Date('2026-09-06T00:00:00.000Z'),
      category,
      externalItemId: null,
      externalItemName: null,
      externalReference: 'REF1',
      senderName: 'Isaac Wakweyika',
      account: { id: 3 },
    }) as any;

  const match = { contact: { id: 42 } } as any;

  beforeEach(async () => {
    routing = {
      isCurrencyRouted: jest.fn().mockReturnValue(false),
      resolveGivingItem: jest.fn().mockResolvedValue({
        kind: 'giver',
        externalItemId: null,
        externalItemName: null,
        currency: 'UGX',
        configuredCurrencies: [],
      }),
      resolveDepositAccount: jest
        .fn()
        .mockResolvedValue({ externalAccountId: null, currency: 'UGX' }),
    };
    mapping = {
      lookupByInternal: jest
        .fn()
        .mockImplementation(({ internalReferenceType }) =>
          Promise.resolve(
            internalReferenceType === 'CONTACT'
              ? { externalReferenceId: 'cust-42' }
              : { externalReferenceId: 'other' },
          ),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorshipHarvestAccountingPlugin,
        {
          provide: getRepositoryToken(Contact),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 42,
              person: { firstName: 'Joshua', lastName: 'Nabugere' },
            }),
          },
        },
        {
          provide: getRepositoryToken(FinancialAccount),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 3, name: 'MoMo', currency: 'UGX' }),
          },
        },
        { provide: ExternalSystemMappingService, useValue: mapping },
        {
          provide: GroupPermissionsService,
          useValue: {
            resolveAttributionForContact: jest.fn().mockResolvedValue({
              location: null,
              fob: null,
              locationIsFallback: false,
              fobIsFallback: false,
            }),
            getRootGroup: jest
              .fn()
              .mockResolvedValue({ id: 1, name: 'WH Global' }),
          },
        },
        {
          provide: TenantContext,
          useValue: { requireTenant: jest.fn().mockReturnValue(1) },
        },
        { provide: CategoryRoutingService, useValue: routing },
      ],
    }).compile();

    plugin = module.get(WorshipHarvestAccountingPlugin);
  });

  const asCollected = () => {
    routing.isCurrencyRouted.mockReturnValue(true);
    routing.resolveGivingItem.mockResolvedValue({
      kind: 'category',
      externalItemId: '91',
      externalItemName: 'Offertory UGX',
      currency: 'UGX',
      configuredCurrencies: ['UGX'],
    });
  };

  it('books tithe under the giver', async () => {
    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.TITHE),
      match,
    );

    expect(receipt.customer.postsAs).toBe('GIVER');
    expect(receipt.customer.externalCustomerId).toBe('cust-42');
    expect(receipt.depositAccount.externalAccountId).toBe('other');
  });

  it('gives offertory no customer at all', async () => {
    asCollected();

    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      null,
    );

    expect(receipt.customer.postsAs).toBe('CATEGORY');
    expect(receipt.customer.externalCustomerId).toBeNull();
  });

  it('keeps every giver name off a collected receipt', async () => {
    asCollected();

    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      match,
    );

    expect(receipt.customer.contactName).toBe('Collected offering');
    expect(receipt.lineItems[0].description).not.toMatch(/Nabugere|Isaac/);
  });

  it('books offertory against its own item while depositing to the bank', async () => {
    asCollected();

    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      null,
    );

    expect(receipt.lineItems[0].externalItemId).toBe('91');
    // QuickBooks only accepts a Bank or Other Current Assets account here.
    expect(receipt.depositAccount.externalAccountId).toBe('other');
    expect(receipt.depositAccount.financialAccountName).toBe('MoMo');
  });

  it('resolves the giving item against the account currency', async () => {
    await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      match,
    );

    expect(routing.resolveGivingItem).toHaveBeenCalledWith('OFFERING', 'UGX');
  });

  it('attributes an unmatched gift to the mother group', async () => {
    asCollected();

    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      null,
    );

    expect(receipt.location?.groupName).toBe('WH Global');
    expect(receipt.location?.isFallback).toBe(true);
  });

  it('deposits to a mapped offering account when one is chosen', async () => {
    asCollected();
    routing.resolveDepositAccount.mockResolvedValue({
      externalAccountId: 'bank-7',
      currency: 'UGX',
    });

    const receipt = await plugin.buildSalesReceipt(
      transaction(TransactionCategory.OFFERING),
      null,
    );

    expect(receipt.depositAccount.externalAccountId).toBe('bank-7');
  });
});
