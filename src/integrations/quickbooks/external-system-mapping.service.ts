import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Like, Repository } from 'typeorm';
import { ExternalSystemMapping } from './entities/external-system-mapping.entity';
import { TenantContext } from '../../shared/tenant/tenant-context';
import {
  CreateMappingDto,
  UpdateMappingDto,
  LookupByInternalDto,
  LookupByExternalDto,
} from './dto/external-system-mapping.dto';

export {
  CreateMappingDto,
  UpdateMappingDto,
  LookupByInternalDto,
  LookupByExternalDto,
} from './dto/external-system-mapping.dto';

/** Neutralises LIKE wildcards so a prefix matches itself literally. */
const escapeLikePattern = (value: string): string =>
  value.replace(/[\%_]/g, (match) => `\${match}`);

@Injectable()
export class ExternalSystemMappingService {
  constructor(
    @InjectRepository(ExternalSystemMapping)
    private readonly repo: Repository<ExternalSystemMapping>,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Callers inside a transaction pass its manager so writes commit together. */
  private repoFor(manager?: EntityManager): Repository<ExternalSystemMapping> {
    return manager ? manager.getRepository(ExternalSystemMapping) : this.repo;
  }

  async create(
    dto: CreateMappingDto,
    manager?: EntityManager,
  ): Promise<ExternalSystemMapping> {
    const tenantId = this.tenantContext.requireTenant();
    const repo = this.repoFor(manager);
    const mapping = repo.create({
      tenantId,
      system: dto.system,
      internalReferenceType: dto.internalReferenceType,
      internalReferenceId: String(dto.internalReferenceId),
      externalReferenceType: dto.externalReferenceType,
      externalReferenceId: dto.externalReferenceId,
      externalReferenceName: dto.externalReferenceName ?? null,
      metadata: dto.metadata ?? null,
    });
    return repo.save(mapping);
  }

  async findAll(system?: string): Promise<ExternalSystemMapping[]> {
    const tenantId = this.tenantContext.requireTenant();
    const where: any = { tenantId };
    if (system) where.system = system;
    return this.repo.find({
      where,
      order: { internalReferenceType: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ExternalSystemMapping> {
    const tenantId = this.tenantContext.requireTenant();
    const mapping = await this.repo.findOne({ where: { id, tenantId } });
    if (!mapping) throw new NotFoundException(`Mapping ${id} not found`);
    return mapping;
  }

  async update(
    id: number,
    dto: UpdateMappingDto,
  ): Promise<ExternalSystemMapping> {
    const mapping = await this.findOne(id);
    if (dto.externalReferenceId !== undefined)
      mapping.externalReferenceId = dto.externalReferenceId;
    if (dto.externalReferenceName !== undefined)
      mapping.externalReferenceName = dto.externalReferenceName;
    if (dto.metadata !== undefined) mapping.metadata = dto.metadata;
    mapping.lastSyncedAt = new Date();
    return this.repo.save(mapping);
  }

  async remove(id: number): Promise<void> {
    const mapping = await this.findOne(id);
    await this.repo.remove(mapping);
  }

  async lookupByInternal(
    dto: LookupByInternalDto,
  ): Promise<ExternalSystemMapping | null> {
    const tenantId = this.tenantContext.requireTenant();
    const where: any = {
      tenantId,
      system: dto.system,
      internalReferenceType: dto.internalReferenceType,
      internalReferenceId: String(dto.internalReferenceId),
    };
    if (dto.externalReferenceType)
      where.externalReferenceType = dto.externalReferenceType;
    return this.repo.findOne({ where });
  }

  /** Mappings of one internal type whose id starts with `prefix`. */
  async listByInternalPrefix(
    system: string,
    internalReferenceType: string,
    prefix: string,
  ): Promise<ExternalSystemMapping[]> {
    const tenantId = this.tenantContext.requireTenant();
    return this.repo.find({
      where: {
        tenantId,
        system,
        internalReferenceType,
        internalReferenceId: Like(`${escapeLikePattern(prefix)}%`),
      },
    });
  }

  async lookupByExternal(
    dto: LookupByExternalDto,
    manager?: EntityManager,
  ): Promise<ExternalSystemMapping | null> {
    const tenantId = this.tenantContext.requireTenant();
    return this.repoFor(manager).findOne({
      where: {
        tenantId,
        system: dto.system,
        externalReferenceType: dto.externalReferenceType,
        externalReferenceId: dto.externalReferenceId,
      },
    });
  }

  async upsert(
    dto: CreateMappingDto,
    manager?: EntityManager,
  ): Promise<ExternalSystemMapping> {
    const tenantId = this.tenantContext.requireTenant();
    const repo = this.repoFor(manager);
    const existing = await repo.findOne({
      where: {
        tenantId,
        system: dto.system,
        internalReferenceType: dto.internalReferenceType,
        internalReferenceId: String(dto.internalReferenceId),
        externalReferenceType: dto.externalReferenceType,
      },
    });
    if (existing) {
      existing.externalReferenceId = dto.externalReferenceId;
      existing.externalReferenceName =
        dto.externalReferenceName ?? existing.externalReferenceName;
      existing.metadata = dto.metadata ?? existing.metadata;
      existing.lastSyncedAt = new Date();
      return repo.save(existing);
    }
    return this.create(dto, manager);
  }
}
