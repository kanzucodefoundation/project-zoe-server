import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';
import { MatchingService } from './matching.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger } from '../../utils/app-logger.service';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';
import { GroupPermissionsService } from '../../groups/services/group-permissions.service';
import { CategoryRoutingService } from './category-routing.service';
import Transaction from '../entities/transaction.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import ContactPaymentMethod from '../entities/contact-payment-method.entity';
import Contact from '../../crm/entities/contact.entity';
import Phone from '../../crm/entities/phone.entity';

describe('MatchingService — suggestions', () => {
  let service: MatchingService;
  let mockGroupPermissions: { resolveAttributionForContact: jest.Mock };
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

    mockGroupPermissions = {
      resolveAttributionForContact: jest.fn().mockResolvedValue({
        location: { id: 6, name: 'WH Arua' },
        fob: { id: 5, name: 'Arua FOB' },
        locationIsFallback: false,
        fobIsFallback: false,
      }),
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
        {
          // Nothing here routes a category to a standing customer, so every
          // transaction stays in the sweep.
          provide: CategoryRoutingService,
          useValue: { isCurrencyRouted: jest.fn().mockReturnValue(false) },
        },
        {
          provide: GroupPermissionsService,
          useValue: mockGroupPermissions,
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
      location: 'WH Arua',
      fob: 'Arua FOB',
      attributionIsFallback: false,
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

  it('tells the reviewer which campus and FOB the gift would post to', async () => {
    mockRepositories.transaction.findOne.mockResolvedValue({ id: 1 });
    jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue({
      contact: { id: 42 } as any,
      confidenceScore: 98,
      matchCriteria: { method: 'tithe_number', matchedValue: 'TBGB0095' },
    });
    mockRepositories.contact.findOne.mockResolvedValue({
      id: 42,
      person: { firstName: 'Elaine', lastName: 'Ayikoru' },
      phones: [{ value: '256777176550' }],
    });

    const [suggestion] = await service.getSuggestionsForTransaction(1, {
      id: 1,
    });

    expect(suggestion.contact.location).toBe('WH Arua');
    expect(suggestion.contact.fob).toBe('Arua FOB');
    expect(suggestion.contact.attributionIsFallback).toBe(false);
  });

  it('flags attribution that fell back to the mother group', async () => {
    mockGroupPermissions.resolveAttributionForContact.mockResolvedValue({
      location: { id: 1, name: 'Worship Harvest Global' },
      fob: { id: 1, name: 'Worship Harvest Global' },
      locationIsFallback: true,
      fobIsFallback: true,
    });
    mockRepositories.transaction.findOne.mockResolvedValue({ id: 1 });
    jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue({
      contact: { id: 42 } as any,
      confidenceScore: 98,
      matchCriteria: { method: 'tithe_number', matchedValue: 'TBGB0095' },
    });
    mockRepositories.contact.findOne.mockResolvedValue({
      id: 42,
      person: { firstName: 'Elaine', lastName: 'Ayikoru' },
      phones: [],
    });

    const [suggestion] = await service.getSuggestionsForTransaction(1, {
      id: 1,
    });

    expect(suggestion.contact.attributionIsFallback).toBe(true);
  });

  describe('runMatching', () => {
    beforeEach(() => {
      mockRepositories.transaction.find = jest.fn().mockResolvedValue([]);
      mockRepositories.match.find = jest.fn().mockResolvedValue([]);
      mockRepositories.match.findOne = jest.fn().mockResolvedValue(null);
      mockRepositories.match.save = jest.fn(async (m: any) => m);
    });

    it('scans every pending transaction when no account is given', async () => {
      // The reconciliation screen defaults to "All Accounts", so this is the
      // ordinary case, not an edge case.
      await service.runMatching(undefined, 60, undefined, undefined, { id: 1 });

      const where = mockRepositories.transaction.find.mock.calls[0][0].where;
      expect(where.account).toBeUndefined();
      expect(where.status).toBe('PENDING');
    });

    it('narrows to one account when asked', async () => {
      await service.runMatching(7, 60, undefined, undefined, { id: 1 });

      const where = mockRepositories.transaction.find.mock.calls[0][0].where;
      expect(where.account).toEqual({ id: 7 });
    });

    it('saves a pending match and auto-approves above the threshold', async () => {
      mockRepositories.transaction.find.mockResolvedValue([
        { id: 1, narration: 'TBGB0095' },
        { id: 2, narration: 'TBGB0416' },
      ]);
      jest
        .spyOn(service, 'findMatchForTransaction')
        .mockResolvedValueOnce({
          contact: { id: 42 } as any,
          confidenceScore: 98,
          matchCriteria: { method: 'tithe_number' },
        })
        .mockResolvedValueOnce({
          contact: { id: 43 } as any,
          confidenceScore: 70,
          matchCriteria: { method: 'fuzzy_name' },
        });

      const result = await service.runMatching(undefined, 60, 95, undefined, {
        id: 1,
      });

      expect(result.processed).toBe(2);
      expect(result.matched).toBe(2);
      expect(result.autoApproved).toBe(1);
      expect(mockRepositories.match.save).toHaveBeenCalledTimes(2);
    });

    it('ignores candidates below the confidence floor', async () => {
      mockRepositories.transaction.find.mockResolvedValue([{ id: 1 }]);
      jest.spyOn(service, 'findMatchForTransaction').mockResolvedValue({
        contact: { id: 42 } as any,
        confidenceScore: 40,
        matchCriteria: { method: 'fuzzy_name' },
      });

      const result = await service.runMatching(
        undefined,
        60,
        undefined,
        undefined,
        {
          id: 1,
        },
      );

      expect(result.matched).toBe(0);
      expect(mockRepositories.match.save).not.toHaveBeenCalled();
    });
  });

  describe('categories with a standing customer', () => {
    it('leaves offertory out of the sweep', async () => {
      const categoryCustomer = (service as any).categoryRoutingService;
      categoryCustomer.isCurrencyRouted.mockImplementation(
        (category: string) => category === 'OFFERING',
      );
      (service as any).transactionRepository.find = jest
        .fn()
        .mockResolvedValue([
          { id: 1, category: 'TITHE', account: { id: 1 } },
          { id: 2, category: 'OFFERING', account: { id: 1 } },
        ]);
      const findMatch = jest
        .spyOn(service, 'findMatchForTransaction')
        .mockResolvedValue(null);

      await service.runMatching(undefined, 60);

      const swept = findMatch.mock.calls.map((call: any[]) => call[0].id);
      expect(swept).toEqual([1]);
    });
  });

  describe('the name in the message', () => {
    it('is matched on ahead of the account the money came from', async () => {
      const repo = (service as any).contactRepository;
      repo.find = jest.fn().mockResolvedValue([
        {
          id: 7,
          person: { firstName: 'Isaac', lastName: 'Wakweyika' },
        },
      ]);
      (service as any).matchRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).paymentMethodRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).contactRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).phoneRepository.find = jest.fn().mockResolvedValue([]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'JANE ACCOUNTHOLDER',
        narration: 'isaac wakweyika tithe',
      } as any);

      expect(candidate?.contact.id).toBe(7);
      expect(candidate?.matchCriteria.method).toBe('fuzzy_name');
    });

    it('falls back to the statement name when the message names nobody', async () => {
      const repo = (service as any).contactRepository;
      repo.find = jest
        .fn()
        .mockResolvedValue([
          { id: 9, person: { firstName: 'Church', lastName: 'Account' } },
        ]);
      (service as any).matchRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).paymentMethodRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).contactRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).phoneRepository.find = jest.fn().mockResolvedValue([]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'Church Account',
        narration: 'Sunday banking',
      } as any);

      expect(candidate?.contact.id).toBe(9);
    });
  });
});
