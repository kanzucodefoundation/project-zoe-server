import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  FindOneOptions,
} from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { Tenant } from 'src/tenants/entities/tenant.entity';

/**
 * Base class for tenant-aware repositories
 *
 * This class automatically adds tenant filtering to all queries for entities
 * that have a tenant relationship.
 *
 * Usage:
 * ```typescript
 * const contactRepository = new TenantAwareRepository(Contact, connection, tenantContext);
 * const contacts = await contactRepository.find(); // Automatically filtered by tenant
 * ```
 */
export class TenantAwareRepository<
  Entity extends { tenant?: Tenant },
> extends Repository<Entity> {
  constructor(
    target: any,
    manager: any,
    private readonly tenantContext: TenantContext,
  ) {
    super(target, manager);
  }

  /**
   * Add tenant filter to where conditions
   */
  private addTenantFilter<T extends FindOptionsWhere<Entity>>(
    where?: T | T[],
  ): T | T[] | undefined {
    const tenantId = this.tenantContext.tenantId;

    if (!tenantId) {
      return where;
    }

    const tenantFilter = { tenant: { id: tenantId } } as T;

    if (!where) {
      return tenantFilter;
    }

    if (Array.isArray(where)) {
      return where.map((w) => ({ ...w, tenant: { id: tenantId } }) as T);
    }

    return { ...where, tenant: { id: tenantId } } as T;
  }

  /**
   * Create a tenant reference object without loading the full entity
   */
  private createTenantReference(tenantId: number): Tenant {
    const tenant = new Tenant();
    tenant.id = tenantId;
    return tenant;
  }

  /**
   * Override find to automatically add tenant filter
   */
  async find(options?: FindManyOptions<Entity>): Promise<Entity[]> {
    const tenantId = this.tenantContext.tenantId;

    if (!tenantId) {
      return super.find(options);
    }

    const modifiedOptions = {
      ...options,
      where: this.addTenantFilter(options?.where),
    };

    return super.find(modifiedOptions);
  }

  /**
   * Override findOne to automatically add tenant filter
   */
  async findOne(options: FindOneOptions<Entity>): Promise<Entity | null> {
    const tenantId = this.tenantContext.tenantId;

    if (!tenantId) {
      return super.findOne(options);
    }

    const modifiedOptions = {
      ...options,
      where: this.addTenantFilter(options?.where),
    };

    return super.findOne(modifiedOptions);
  }

  /**
   * Override findAndCount to automatically add tenant filter
   */
  async findAndCount(
    options?: FindManyOptions<Entity>,
  ): Promise<[Entity[], number]> {
    const tenantId = this.tenantContext.tenantId;

    if (!tenantId) {
      return super.findAndCount(options);
    }

    const modifiedOptions = {
      ...options,
      where: this.addTenantFilter(options?.where),
    };

    return super.findAndCount(modifiedOptions);
  }

  /**
   * Override save to automatically add tenant to new entities
   */
  async save<T extends Entity>(entity: T): Promise<T>;
  async save<T extends Entity>(entities: T[]): Promise<T[]>;
  async save<T extends Entity>(entityOrEntities: T | T[]): Promise<T | T[]> {
    const tenantId = this.tenantContext.tenantId;

    if (!tenantId) {
      return super.save(entityOrEntities as any);
    }

    if (Array.isArray(entityOrEntities)) {
      const entitiesWithTenant = entityOrEntities.map((entity) => {
        if (!entity.tenant) {
          entity.tenant = this.createTenantReference(tenantId);
        }
        return entity;
      });
      return super.save(entitiesWithTenant as any);
    } else {
      if (!entityOrEntities.tenant) {
        entityOrEntities.tenant = this.createTenantReference(tenantId);
      }
      return super.save(entityOrEntities as any);
    }
  }

  /**
   * Override create to automatically add tenant
   */
  create(entityLike?: any): Entity;
  create(entityLikes?: any[]): Entity[];
  create(entityLikeOrLikes?: any | any[]): Entity | Entity[] {
    const tenantId = this.tenantContext.tenantId;

    if (Array.isArray(entityLikeOrLikes)) {
      const entities = super.create(entityLikeOrLikes as any[]);
      if (tenantId) {
        entities.forEach((entity) => {
          if (!entity.tenant) {
            entity.tenant = this.createTenantReference(tenantId);
          }
        });
      }
      return entities;
    }

    const entity = super.create(entityLikeOrLikes as any) as unknown as Entity;
    if (tenantId && !entity.tenant) {
      entity.tenant = this.createTenantReference(tenantId);
    }
    return entity;
  }
}
