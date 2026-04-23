import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { Connection } from 'typeorm';
import { TenantContext } from 'src/shared/tenant/tenant-context';

describe('RolesService', () => {
  let service: RolesService;
  let mockRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    const mockTenantContext = {
      requireTenant: jest.fn().mockReturnValue(7),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: TenantContext,
          useValue: mockTenantContext,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should attach tenant context when creating a role', async () => {
    const dto = {
      role: 'FINANCE',
      description: 'finance-related actions',
      permissions: ['FINANCE_VIEW', 'FINANCE_EDIT', 'DASHBOARD'],
      isActive: true,
    } as any;

    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.save.mockImplementation(async (payload) => payload);

    const result = await service.create(dto);

    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dto,
        tenant: { id: 7 },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ...dto,
        tenant: { id: 7 },
      }),
    );
  });
});
