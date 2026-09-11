import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalSystemMapping } from './entities/external-system-mapping.entity';
import { TenantContext } from '../../shared/tenant/tenant-context';

export interface CreateMappingDto {
  system: string;
  internalReferenceType: string;
  internalReferenceId: string;
  externalReferenceType: string;
  externalReferenceId: string;
  externalReferenceName?: string;
  metadata?: Record<string, any>;
}

export interface UpdateMappingDto {
  externalReferenceId?: string;
  externalReferenceName?: string;
  metadata?: Record<string, any>;
}

export interface LookupByInternalDto {
  system: string;
  internalReferenceType: string;
  internalReferenceId: string | number;
  externalReferenceType?: string;
}

export interface LookupByExternalDto {
  system: string;
  externalReferenceType: string;
  externalReferenceId: string;
}

@Injectable()
export class ExternalSystemMappingService {
  constructor(
    @InjectRepository(ExternalSystemMapping)
    private readonly repo: Repository<ExternalSystemMapping>,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateMappingDto): Promise<ExternalSystemMapping> {
    const tenantId = this.tenantContext.requireTenant();
    const mapping = this.repo.create({
      tenantId,
      system: dto.system,
      internalReferenceType: dto.internalReferenceType,
      internalReferenceId: String(dto.internalReferenceId),
      externalReferenceType: dto.externalReferenceType,
      externalReferenceId: dto.externalReferenceId,
      externalReferenceName: dto.externalReferenceName ?? null,
      metadata: dto.metadata ?? null,
    });
    return this.repo.save(mapping);
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

  async lookupByExternal(
    dto: LookupByExternalDto,
  ): Promise<ExternalSystemMapping | null> {
    const tenantId = this.tenantContext.requireTenant();
    return this.repo.findOne({
      where: {
        tenantId,
        system: dto.system,
        externalReferenceType: dto.externalReferenceType,
        externalReferenceId: dto.externalReferenceId,
      },
    });
  }

  async upsert(dto: CreateMappingDto): Promise<ExternalSystemMapping> {
    const tenantId = this.tenantContext.requireTenant();
    const existing = await this.repo.findOne({
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
      return this.repo.save(existing);
    }
    return this.create(dto);
  }
}
