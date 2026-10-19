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

describe('MatchingService — suggestions', () => {
  let service: MatchingService;
  let mockGroupPermissions: { resolveAttributionForContact: jest.Mock };
  let mockRepositories: any;

  beforeEach(async () => {
    mockRepositories = {
      transaction: { findOne: jest.fn() },
      match: {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
      },
      paymentMethod: { find: jest.fn() },
      contact: {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
      },
    };

    const mockConnection: Partial<Connection> = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Transaction) return mockRepositories.transaction;
        if (entity === ReconciliationMatch) return mockRepositories.match;
        if (entity === ContactPaymentMethod)
          return mockRepositories.paymentMethod;
        if (entity === Contact) return mockRepositories.contact;
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
    const withRoster = (contacts: any[]) => {
      (service as any).contactRepository.find = jest
        .fn()
        .mockResolvedValue(contacts);
      (service as any).matchRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).paymentMethodRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).paymentMethodRepository.find = jest
        .fn()
        .mockResolvedValue([]);
    };

    it('is matched on ahead of the account the money came from', async () => {
      withRoster([
        { id: 7, person: { firstName: 'Isaac', lastName: 'Wakweyika' } },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'JANE ACCOUNTHOLDER',
        narration: 'isaac wakweyika tithe',
      } as any);

      expect(candidate?.contact.id).toBe(7);
      expect(candidate?.matchCriteria.method).toBe('fuzzy_name');
    });

    it('stops rather than charging the account holder when the message name ties', async () => {
      // Two Grace Nakatos fit the narration equally well. Falling through to
      // senderName would book the gift to whoever owns the phone.
      withRoster([
        { id: 11, person: { firstName: 'Grace', lastName: 'Nakato' } },
        { id: 12, person: { firstName: 'Grace', lastName: 'Nakato' } },
        { id: 13, person: { firstName: 'Jane', lastName: 'Accountholder' } },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'Jane Accountholder',
        narration: 'grace nakato tithe',
      } as any);

      expect(candidate).toBeNull();
    });

    it('still falls back to the statement name when the tie is on that name', async () => {
      // The narration names nobody, so senderName is the only candidate and
      // the fallback must still run.
      withRoster([
        { id: 21, person: { firstName: 'Church', lastName: 'Account' } },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'Church Account',
        narration: 'ugx 5000',
      } as any);

      expect(candidate?.contact.id).toBe(21);
    });

    it('does not fall through to the phone when the tithe number is ambiguous', async () => {
      // The account holder is a real, unique phone match at 90. Without the
      // stop, the gift would be auto-approved to them rather than to one of
      // the two people whose tithe number was written in the message.
      withRoster([
        { id: 51, titheNumber: 'TBG9088', person: { firstName: 'A', lastName: 'One' } },
        { id: 52, titheNumber: 'tbg-9088', person: { firstName: 'B', lastName: 'Two' } },
        {
          id: 53,
          person: { firstName: 'Jane', lastName: 'Accountholder' },
          phones: [{ value: '+256700000222' }],
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        narration: 'tithe TBG9088',
        senderPhone: '+256700000222',
      } as any);

      expect(candidate).toBeNull();
    });

    it('still matches one contact holding the same number twice', async () => {
      // "+256700000444" and "0700000444" normalise alike. That is one person,
      // not a collision, so it must not be treated as ambiguous.
      withRoster([
        {
          id: 71,
          person: { firstName: 'Grace', lastName: 'Nakato' },
          phones: [{ value: '+256700000444' }, { value: '0700000444' }],
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderPhone: '+256700000444',
      } as any);

      expect(candidate?.contact.id).toBe(71);
    });

    it('does not fall through to contact phone when payment methods are ambiguous', async () => {
      // A third person lists the same number, uniquely, so contact-phone
      // matching would hand back a 90 and auto-approve to the wrong giver.
      withRoster([
        { id: 81, person: { firstName: 'A', lastName: 'One' } },
        { id: 82, person: { firstName: 'B', lastName: 'Two' } },
        {
          id: 83,
          person: { firstName: 'C', lastName: 'Three' },
          phones: [{ value: '+256700000555' }],
        },
      ]);
      (service as any).paymentMethodRepository.find = jest
        .fn()
        .mockResolvedValue([{ contact: { id: 81 } }, { contact: { id: 82 } }]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderPhoneNormalized: '+256700000555',
        senderPhone: '+256700000555',
      } as any);

      expect(candidate).toBeNull();
    });

    it('refuses a payment method two contacts registered', async () => {
      // valueNormalized is not unique, so the old findOne returned whichever
      // row came first -- at 95, which auto-approves.
      withRoster([
        { id: 61, person: { firstName: 'A', lastName: 'One' } },
        { id: 62, person: { firstName: 'B', lastName: 'Two' } },
      ]);
      (service as any).paymentMethodRepository.find = jest
        .fn()
        .mockResolvedValue([
          { contact: { id: 61 } },
          { contact: { id: 62 } },
        ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderPhoneNormalized: '+256700000333',
      } as any);

      expect(candidate).toBeNull();
    });

    it('refuses a phone line two contacts share', async () => {
      // A household line identifies neither, and a phone match auto-approves.
      withRoster([
        {
          id: 41,
          person: { firstName: 'A', lastName: 'One' },
          phones: [{ value: '+256700000111' }],
        },
        {
          id: 42,
          person: { firstName: 'B', lastName: 'Two' },
          phones: [{ value: '0700000111' }],
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderPhone: '+256700000111',
      } as any);

      expect(candidate).toBeNull();
    });

    it('refuses a tithe number two contacts share', async () => {
      withRoster([
        { id: 31, titheNumber: 'TBG9088', person: { firstName: 'A', lastName: 'One' } },
        { id: 32, titheNumber: 'tbg-9088', person: { firstName: 'B', lastName: 'Two' } },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        narration: 'tithe TBG9088',
      } as any);

      expect(candidate).toBeNull();
    });

    it('falls back to the statement name when the message names nobody', async () => {
      withRoster([
        { id: 9, person: { firstName: 'Church', lastName: 'Account' } },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'Church Account',
        narration: 'Sunday banking',
      } as any);

      expect(candidate?.contact.id).toBe(9);
    });

    it('matches a name the statement wrote in a different order', async () => {
      withRoster([
        {
          id: 11,
          person: {
            firstName: 'Elaine',
            middleName: 'Keziah',
            lastName: 'Ayikoru',
          },
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'AYIKORU ELAINE',
      } as any);

      expect(candidate?.contact.id).toBe(11);
      expect(candidate?.matchCriteria.method).toBe('fuzzy_name');
    });

    it('considers every contact, not an arbitrary first slice', async () => {
      const roster = Array.from({ length: 900 }, (_, i) => ({
        id: i + 1,
        person: { firstName: `Member${i + 1}`, lastName: 'Filler' },
      }));
      roster.push({
        id: 901,
        person: { firstName: 'Shammah', lastName: 'Arinaitwe' },
      });
      withRoster(roster);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        senderName: 'Shammah Arinaitwe',
      } as any);

      expect(candidate?.contact.id).toBe(901);
      expect(
        (service as any).contactRepository.find.mock.calls[0][0].take,
      ).toBeUndefined();
    });
  });

  describe('the tithe number in the message', () => {
    const withTitheRoster = (contacts: any[]) => {
      (service as any).contactRepository.find = jest
        .fn()
        .mockResolvedValue(contacts);
      (service as any).matchRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).paymentMethodRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).paymentMethodRepository.find = jest
        .fn()
        .mockResolvedValue([]);
    };

    it('matches however the giver punctuated it', async () => {
      withTitheRoster([
        {
          id: 21,
          titheNumber: 'tbg9088',
          person: { firstName: 'Joshua', lastName: 'Nabugere' },
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        narration: 'tithe TBG-9088',
      } as any);

      expect(candidate?.contact.id).toBe(21);
      expect(candidate?.matchCriteria.method).toBe('tithe_number');
      expect(candidate?.confidenceScore).toBe(98);
    });

    it('reads the number the importer already parsed out', async () => {
      withTitheRoster([
        {
          id: 22,
          titheNumber: 'TBGB0095',
          person: { firstName: 'Patricia', lastName: 'Nandera' },
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        narration: 'offering',
        rawData: { titheNumber: 'TBGB0095' },
      } as any);

      expect(candidate?.contact.id).toBe(22);
      expect(candidate?.matchCriteria.method).toBe('tithe_number');
    });

    it('does not match a tithe number nobody holds', async () => {
      withTitheRoster([
        {
          id: 23,
          titheNumber: 'TBGB0095',
          person: { firstName: 'Patricia', lastName: 'Nandera' },
        },
      ]);

      const candidate = await service.findMatchForTransaction({
        id: 1,
        narration: 'tithe TBGB9999',
      } as any);

      expect(candidate).toBeNull();
    });
  });

  describe('sweeping a batch', () => {
    it('loads the contact roster once for the whole sweep', async () => {
      (service as any).transactionRepository.find = jest
        .fn()
        .mockResolvedValue([
          { id: 1, senderName: 'A One', account: { id: 1 } },
          { id: 2, senderName: 'B Two', account: { id: 1 } },
          { id: 3, senderName: 'C Three', account: { id: 1 } },
        ]);
      (service as any).matchRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).matchRepository.find = jest.fn().mockResolvedValue([]);
      (service as any).matchRepository.save = jest.fn();
      (service as any).paymentMethodRepository.findOne = jest
        .fn()
        .mockResolvedValue(null);
      (service as any).paymentMethodRepository.find = jest
        .fn()
        .mockResolvedValue([]);
      const contactFind = jest.fn().mockResolvedValue([]);
      (service as any).contactRepository.find = contactFind;

      await service.runMatching(undefined, 60);

      expect(contactFind).toHaveBeenCalledTimes(1);
    });
  });
});
