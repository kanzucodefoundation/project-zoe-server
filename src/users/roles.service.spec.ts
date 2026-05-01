import { Test, TestingModule } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Connection } from 'typeorm';
import { TenantContext } from 'src/shared/tenant/tenant-context';
import { roleAdmin } from 'src/auth/constants';

describe('RolesService', () => {
  let service: RolesService;
  let mockRequest: any;
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
    mockRequest = {
      user: {
        roles: [],
      },
    };

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
        {
          provide: REQUEST,
          useValue: mockRequest,
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

  it('should block non-admin users from editing the admin role', async () => {
    const dto = {
      id: 1,
      role: roleAdmin.role,
      description: 'updated description',
      permissions: ['ROLE_EDIT'],
      isActive: true,
    } as any;

    mockRepository.findOne.mockResolvedValue({
      id: 1,
      role: roleAdmin.role,
      description: roleAdmin.description,
      permissions: roleAdmin.permissions,
      isActive: true,
      tenant: { id: 7 },
    });

    await expect(service.update(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should allow roleAdmin users to edit the admin role', async () => {
    mockRequest.user.roles = [roleAdmin.role];

    const existingRole = {
      id: 1,
      role: roleAdmin.role,
      description: roleAdmin.description,
      permissions: roleAdmin.permissions,
      isActive: true,
      tenant: { id: 7 },
    };
    const dto = {
      id: 1,
      role: roleAdmin.role,
      description: 'updated description',
      permissions: ['ROLE_EDIT'],
      isActive: true,
    } as any;

    mockRepository.findOne.mockResolvedValue(existingRole);
    mockRepository.save.mockImplementation(async (payload) => payload);

    const result = await service.update(dto);

    expect(mockRepository.save).toHaveBeenCalledWith({
      ...existingRole,
      ...dto,
      tenant: { id: 7 },
    });
    expect(result).toEqual({
      ...existingRole,
      ...dto,
      tenant: { id: 7 },
    });
  });
});
