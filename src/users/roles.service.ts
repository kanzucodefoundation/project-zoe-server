import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { roleAdmin } from 'src/auth/constants';
import SearchDto from 'src/shared/dto/search.dto';
import { TenantContext } from 'src/shared/tenant/tenant-context';
import { hasValue } from 'src/utils/validation';
import { ILike, Repository, Connection } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { RolesDto } from './dto/roles.dto';
import Roles from './entities/roles.entity';

@Injectable()
export class RolesService {
  private readonly repository: Repository<Roles>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
    @Inject(REQUEST) private readonly request: any,
  ) {
    this.repository = connection.getRepository(Roles);
  }

  private isLoggedInUserRoleAdmin(): boolean {
    return (
      Array.isArray(this.request?.user?.roles) &&
      this.request.user.roles.includes(roleAdmin.role)
    );
  }

  async create(userRole: RolesDto): Promise<RolesDto> {
    const tenantId = this.tenantContext.requireTenant();
    const checkRole = await this.repository.findOne({
      where: {
        role: userRole.role,
        tenant: { id: tenantId } as any,
      },
    });

    if (checkRole) {
      throw new BadRequestException({
        message:
          'Duplicate role or permission entry detected. Contact your administrator',
      });
    }
    return await this.repository.save({
      ...userRole,
      tenant: { id: tenantId } as Tenant,
    });
  }

  async findAll(req: SearchDto): Promise<RolesDto[]> {
    const tenantId = this.tenantContext.requireTenant();
    const filter: Record<string, any> = {
      tenant: { id: tenantId } as any,
    };

    if (hasValue(req.query)) {
      filter.role = ILike(`%${req.query.trim().toLowerCase()}%`);
    }

    return await this.repository.find({
      where: filter,
    });
  }

  async findOne(id: number): Promise<RolesDto> {
    const tenantId = this.tenantContext.requireTenant();
    return await this.repository.findOne({
      where: { id, tenant: { id: tenantId } as any },
    });
  }

  async update(userRole: RolesDto): Promise<RolesDto> {
    const tenantId = this.tenantContext.requireTenant();
    const checkRole = await this.repository.findOne({
      where: { id: userRole.id, tenant: { id: tenantId } as any },
    });
    if (!checkRole) {
      throw new NotFoundException({
        message: 'Role not found',
      });
    }
    if (checkRole.role === roleAdmin.role && !this.isLoggedInUserRoleAdmin()) {
      throw new BadRequestException({
        message: 'Unable to edit an Admin role. Contact your administrator',
      });
    }
    return await this.repository.save({
      ...checkRole,
      ...userRole,
      tenant: { id: tenantId } as Tenant,
    });
  }

  async remove(roleId: number): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();
    const checkRole = await this.repository.findOne({
      where: { id: roleId, tenant: { id: tenantId } as any },
    });
    if (!checkRole) {
      throw new NotFoundException({
        message: 'Role not found',
      });
    }
    if (checkRole.role === roleAdmin.role) {
      throw new BadRequestException({
        message: 'Unable to delete an Admin role. Contact your administrator',
      });
    }

    if (checkRole.isActive) {
      throw new BadRequestException({
        message:
          'Unable to delete an active role. Make sure no users have been assigned this role',
      });
    }
    await this.repository.remove(checkRole);
  }
}
