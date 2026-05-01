import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import GroupCategory from '../entities/groupCategory.entity';
import { TenantContext } from '../../shared/tenant/tenant-context';

@Injectable()
export class GroupCategoriesService {
  private readonly repository: Repository<GroupCategory>;
  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
  ) {
    this.repository = connection.getRepository(GroupCategory);
  }

  async findAll(req: SearchDto): Promise<GroupCategory[]> {
    const tenantId = this.tenantContext.tenantId;
    return await this.repository.find({
      where: tenantId ? { tenant: { id: tenantId } } : {},
      skip: req.skip,
      take: req.limit,
      relations: ['tenant'],
    });
  }

  async create(data: GroupCategory): Promise<GroupCategory> {
    const tenantId = data?.tenant?.id ?? this.tenantContext?.tenantId;
    if (!tenantId) {
      throw new NotFoundException(
        'Tenant context is required to create a group category',
      );
    }
    const existing = await this.repository.findOne({
      where: {
        name: data.name,
        tenant: { id: tenantId },
      },
      relations: ['tenant'],
    });

    if (existing) {
      throw new ConflictException(
        `Group category "${data.name}" already exists for this tenant`,
      );
    }

    const category = this.repository.create({
      id: data.id,
      name: data.name,
      purpose: data.purpose ?? null,
      tenant: data.tenant ?? ({ id: tenantId } as any),
    });

    return await this.repository.save(category);
  }

  async findOne(id: number): Promise<GroupCategory> {
    const tenantId = this.tenantContext.tenantId;
    return await this.repository.findOne({
      where: tenantId ? { id, tenant: { id: tenantId } } : { id },
      relations: ['tenant'],
    });
  }

  async update(data: GroupCategory): Promise<GroupCategory> {
    const tenantId = data?.tenant?.id ?? this.tenantContext?.tenantId;
    if (!tenantId) {
      throw new NotFoundException(
        'Tenant context is required to update a group category',
      );
    }
    const current = await this.repository.findOne({
      where: { id: data.id, tenant: { id: tenantId } },
      relations: ['tenant'],
    });

    if (!current) {
      throw new NotFoundException(
        `Group category ${data.id} not found for this tenant`,
      );
    }

    if (data.name && data.name !== current.name) {
      const duplicate = await this.repository.findOne({
        where: {
          name: data.name,
          tenant: { id: tenantId },
        },
      });

      if (duplicate && duplicate.id !== current.id) {
        throw new ConflictException(
          `Group category "${data.name}" already exists for this tenant`,
        );
      }
    }

    current.name = data.name ?? current.name;
    if (Object.prototype.hasOwnProperty.call(data, 'purpose')) {
      current.purpose = data.purpose ?? null;
    }
    current.tenant = current.tenant ?? ({ id: tenantId } as any);

    return await this.repository.save(current);
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.tenantId;
    if (tenantId) {
      await this.repository.delete({
        id: Number(id),
        tenant: { id: tenantId },
      } as any);
      return;
    }

    await this.repository.delete(id);
  }

  async exists(name: string): Promise<boolean> {
    const tenantId = this.tenantContext.tenantId;
    const count = await this.repository.count({
      where: tenantId ? { name, tenant: { id: tenantId } } : { name },
    });
    return count > 0;
  }
}
