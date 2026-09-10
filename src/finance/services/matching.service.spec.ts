import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { MatchingService } from './matching.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import ContactPaymentMethod from '../entities/contact-payment-method.entity';
import Contact from '../../crm/entities/contact.entity';
import Phone from '../../crm/entities/phone.entity';

describe('MatchingService — suggestions', () => {
  let service: MatchingService;
  let mockRepositories: any;

  beforeEach(async () => {
    mockRepositories = {
      transaction: { findOne: jest.fn() },
      match: { find: jest.fn(), findOne: jest.fn() },
      paymentMethod: { find: jest.fn() },
      contact: { find: jest.fn(), findOne: jest.fn() },
      phone: { find: jest.fn() },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Transaction) return mockRepositories.transaction;
        if (entity === ReconciliationMatch) return mockRepositories.match;
        if (entity === ContactPaymentMethod)
          return mockRepositories.paymentMethod;
        if (entity === Contact) return mockRepositories.contact;
        if (entity === Phone) return mockRepositories.phone;
        return {};
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
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
          useValue: { get: jest.fn(), getDefault: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  it('404s for a transaction outside the tenant', async () => {
    mockRepositories.transaction.findOne.mockResolvedValue(null);

    await expect(
      service.getSuggestionsForTransaction(7, { id: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns an empty list when nothing matches', async () => {
    mockRepositories.transaction.findOne.mockResolvedValue({ id: 7 });
    jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue(null);

    await expect(
      service.getSuggestionsForTransaction(7, { id: 1 }),
    ).resolves.toEqual([]);
  });

  it('explains the match in words the screen can show', async () => {
    mockRepositories.transaction.findOne.mockResolvedValue({ id: 7 });
    jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue({
      contact: { id: 42 } as any,
      confidenceScore: 87.5,
      matchCriteria: {
        method: 'contact_phone_normalized',
        matchedValue: '256771234567',
        // Whole percentage, matching what findMatchForTransaction stores
        similarity: 92,
        historicalBonus: true,
      },
    });
    mockRepositories.contact.findOne.mockResolvedValue({
      id: 42,
      person: { firstName: 'Jane', lastName: 'Doe' },
      phones: [{ value: '0771234567' }],
    });

    const [suggestion] = await service.getSuggestionsForTransaction(7, {
      id: 1,
    });

    expect(suggestion.contact).toEqual({
      id: 42,
      name: 'Jane Doe',
      phone: '0771234567',
    });
    expect(suggestion.confidenceScore).toBe(87.5);
    // The raw method identifier must not leak into the UI
    expect(suggestion.matchReasons).toEqual([
      'Contact phone number (normalised)',
      'Matched on 256771234567',
      '92% name similarity',
      'Previously reconciled to this contact',
    ]);
  });

  it('re-reads the contact so person/phones are always populated', async () => {
    mockRepositories.transaction.findOne.mockResolvedValue({ id: 7 });
    // A candidate whose contact came back without relations loaded
    jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue({
      contact: { id: 42 } as any,
      confidenceScore: 50,
      matchCriteria: { method: 'fuzzy_name' },
    });
    mockRepositories.contact.findOne.mockResolvedValue({
      id: 42,
      person: { firstName: 'Ann', lastName: 'Kim' },
      phones: [],
    });

    const [suggestion] = await service.getSuggestionsForTransaction(7, {
      id: 1,
    });

    expect(mockRepositories.contact.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42, tenant: { id: 1 } },
        relations: ['person', 'phones'],
      }),
    );
    expect(suggestion.contact.name).toBe('Ann Kim');
    expect(suggestion.contact.phone).toBeUndefined();
    expect(suggestion.matchReasons).toEqual(['Similar sender name']);
  });
});
