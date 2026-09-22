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
