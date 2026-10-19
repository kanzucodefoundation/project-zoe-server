import { Test, TestingModule } from '@nestjs/testing';
import { CategoryRoutingService } from './category-routing.service';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';

describe('CategoryRoutingService', () => {
  let service: CategoryRoutingService;
  let mapping: {
    lookupByInternal: jest.Mock;
    listByInternalPrefix: jest.Mock;
  };

  beforeEach(async () => {
    mapping = {
      lookupByInternal: jest.fn().mockResolvedValue(null),
      listByInternalPrefix: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryRoutingService,
        { provide: ExternalSystemMappingService, useValue: mapping },
      ],
    }).compile();

    service = module.get(CategoryRoutingService);
  });

  it('treats only collected categories as currency-routed', () => {
    expect(service.isCurrencyRouted('OFFERING')).toBe(true);
    expect(service.isCurrencyRouted('TITHE')).toBe(false);
    expect(service.isCurrencyRouted('DONATION')).toBe(false);
    expect(service.isCurrencyRouted('ARISE_BUILD')).toBe(false);
  });

  /**
   * Every offertory is collected in the room, but only a message naming the
   * word reaches the OFFERING category: a YXP or children's church collection
   * defaults to tithe, and "thanksgiving" reads as a donation.
   */
  it('treats any offertory item as collected whatever its category', () => {
    expect(service.isCollected('TITHE', 'Offertory - YXP')).toBe(true);
    expect(service.isCollected('TITHE', "Offertory - Children's Church")).toBe(
      true,
    );
    expect(service.isCollected('DONATION', 'Offertory - Thanksgiving')).toBe(
      true,
    );
    expect(service.isCollected('OFFERING', null)).toBe(true);
  });

  it('still requires a giver for giving a person made themselves', () => {
    expect(service.isCollected('TITHE', 'Tithes')).toBe(false);
    expect(service.isCollected('TITHE', null)).toBe(false);
    expect(service.isCollected('ARISE_BUILD', 'Arise and Build')).toBe(false);
    expect(service.isCollected('DONATION', 'Donations')).toBe(false);
  });

  it('books a collected gift under the offering category', () => {
    expect(service.collectedCategoryKey('TITHE')).toBe('OFFERING');
    expect(service.collectedCategoryKey('DONATION')).toBe('OFFERING');
    expect(service.collectedCategoryKey('OFFERING')).toBe('OFFERING');
  });

  it('resolves the standing customer for collected giving', async () => {
    mapping.lookupByInternal.mockResolvedValueOnce({
      externalReferenceId: '77',
      externalReferenceName: 'Offertory UGX',
    });

    const result = await service.resolveCategoryCustomer('OFFERING', 'ugx');

    expect(result.externalCustomerId).toBe('77');
    expect(result.externalCustomerName).toBe('Offertory UGX');
    expect(result.mappingKey).toBe('OFFERING:UGX');
    expect(mapping.lookupByInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        internalReferenceId: 'OFFERING:UGX',
        externalReferenceType: 'CUSTOMER',
      }),
    );
  });

  it('reports no standing customer when none is mapped', async () => {
    mapping.lookupByInternal.mockResolvedValueOnce(null);

    const result = await service.resolveCategoryCustomer('TITHE', 'USD');

    expect(result.externalCustomerId).toBeNull();
    expect(result.mappingKey).toBe('OFFERING:USD');
  });

  it('leaves tithe on its own category item', async () => {
    const result = await service.resolveGivingItem('TITHE', 'UGX');

    expect(result.kind).toBe('giver');
    expect(result.externalItemId).toBeNull();
    expect(mapping.lookupByInternal).not.toHaveBeenCalled();
  });

  it('books offertory against the item mapped for its currency', async () => {
    mapping.lookupByInternal.mockResolvedValue({
      externalReferenceId: '91',
      externalReferenceName: 'Offertory UGX',
    });

    const result = await service.resolveGivingItem('OFFERING', 'UGX');

    expect(result.kind).toBe('category');
    expect(result.externalItemId).toBe('91');
    expect(mapping.lookupByInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        internalReferenceId: 'OFFERING:UGX',
        externalReferenceType: 'ITEM',
      }),
    );
  });

  it('blocks rather than defaulting when the currency is unmapped', async () => {
    const result = await service.resolveGivingItem('OFFERING', 'ZAR');

    expect(result.kind).toBe('unconfigured');
    expect(result.externalItemId).toBeNull();
  });

  it('upper-cases the currency so one item cannot be mapped twice', async () => {
    mapping.lookupByInternal.mockResolvedValue({
      externalReferenceId: '91',
      externalReferenceName: 'Offertory UGX',
    });

    const result = await service.resolveGivingItem('OFFERING', 'ugx');

    expect(result.currency).toBe('UGX');
    expect(mapping.lookupByInternal).toHaveBeenCalledWith(
      expect.objectContaining({ internalReferenceId: 'OFFERING:UGX' }),
    );
  });

  it('assumes shillings when the account names no currency', async () => {
    const result = await service.resolveGivingItem('OFFERING', null);

    expect(result.currency).toBe('UGX');
  });
});
