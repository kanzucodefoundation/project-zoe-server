import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Connection, Repository, TreeRepository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupCategory from '../entities/groupCategory.entity';
import { GroupPrivacy } from '../enums/groupPrivacy';
import { GroupCategoryNames } from '../enums/groups';
import { TenantContext } from 'src/shared/tenant/tenant-context';
import { FellowshipSchedule } from 'src/attendance/entities/fellowship-schedule.entity';
import { GroupCategoryPurpose } from '../enums/groups';

export interface BulkGroupRow {
  location: string;
  zone?: string;
  sector?: string;
  mc: string;
}

export interface BulkImportResult {
  totalRows: number;
  created: { zones: number; sectors: number; mcs: number };
  skipped: { zones: number; sectors: number; mcs: number };
  errors: string[];
}

@Injectable()
export class GroupImportService {
  private readonly groupRepo: Repository<Group>;
  private readonly treeRepo: TreeRepository<Group>;
  private readonly categoryRepo: Repository<GroupCategory>;
  private readonly scheduleRepo: Repository<FellowshipSchedule>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly tenantContext: TenantContext,
  ) {
    this.groupRepo = connection.getRepository(Group);
    this.treeRepo = connection.getTreeRepository(Group);
    this.categoryRepo = connection.getRepository(GroupCategory);
    this.scheduleRepo = connection.getRepository(FellowshipSchedule);
  }

  async bulkImport(rows: BulkGroupRow[]): Promise<BulkImportResult> {
    const tenantId = this.tenantContext.requireTenant();

    const [locationCat, zoneCat, sectorCat, mcCat] = await Promise.all([
      this.findCategory(GroupCategoryNames.LOCATION, tenantId),
      this.findCategory(GroupCategoryNames.ZONE, tenantId),
      this.findCategory('Sector', tenantId),
      this.findCategory(GroupCategoryNames.MC, tenantId),
    ]);

    if (!mcCat) {
      throw new BadRequestException(
        `"${GroupCategoryNames.MC}" category not found for this tenant.`,
      );
    }

    const result: BulkImportResult = {
      totalRows: rows.length,
      created: { zones: 0, sectors: 0, mcs: 0 },
      skipped: { zones: 0, sectors: 0, mcs: 0 },
      errors: [],
    };

    for (const [index, row] of rows.entries()) {
      const rowNum = index + 2; // account for header row
      try {
        const locationName = row.location?.trim();
        const mcName = row.mc?.trim();

        if (!locationName) {
          result.errors.push(`Row ${rowNum}: "location" is required.`);
          continue;
        }
        if (!mcName) {
          result.errors.push(`Row ${rowNum}: "mc" is required.`);
          continue;
        }

        const location = await this.findByName(
          locationName,
          locationCat,
          tenantId,
        );
        if (!location) {
          result.errors.push(
            `Row ${rowNum}: Location "${locationName}" not found. Locations must already exist.`,
          );
          continue;
        }

        let parent = location;

        if (row.zone?.trim()) {
          if (!zoneCat) {
            result.errors.push(
              `Row ${rowNum}: Zone category ("${GroupCategoryNames.ZONE}") not found for this tenant.`,
            );
            continue;
          }
          const [zone, wasCreated] = await this.findOrCreate(
            row.zone.trim(),
            zoneCat,
            tenantId,
            parent,
          );
          wasCreated ? result.created.zones++ : result.skipped.zones++;
          parent = zone;
        }

        if (row.sector?.trim()) {
          if (!sectorCat) {
            result.errors.push(
              `Row ${rowNum}: Sector category not found for this tenant.`,
            );
            continue;
          }
          const [sector, wasCreated] = await this.findOrCreate(
            row.sector.trim(),
            sectorCat,
            tenantId,
            parent,
          );
          wasCreated ? result.created.sectors++ : result.skipped.sectors++;
          parent = sector;
        }

        const [mc, wasCreated] = await this.findOrCreate(
          mcName,
          mcCat,
          tenantId,
          parent,
        );
        if (wasCreated) {
          result.created.mcs++;
          await this.ensureFellowshipSchedule(mc.id, tenantId);
        } else {
          result.skipped.mcs++;
        }
      } catch (err) {
        result.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    return result;
  }

  private async findCategory(
    name: string,
    tenantId: number,
  ): Promise<GroupCategory | null> {
    return this.categoryRepo
      .createQueryBuilder('c')
      .where('c.name = :name', { name })
      .andWhere('c."tenantId" = :tenantId', { tenantId })
      .getOne();
  }

  private async findByName(
    name: string,
    category: GroupCategory | null,
    tenantId: number,
  ): Promise<Group | null> {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId })
      .andWhere('LOWER(g.name) = LOWER(:name)', { name });
    if (category) {
      qb.andWhere('g."categoryId" = :catId', { catId: category.id });
    }
    return qb.getOne();
  }

  private async findOrCreate(
    name: string,
    category: GroupCategory,
    tenantId: number,
    parent: Group,
  ): Promise<[Group, boolean]> {
    const existing = await this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('LOWER(g.name) = LOWER(:name)', { name })
      .andWhere('g."parentId" = :parentId', { parentId: parent.id })
      .getOne();

    if (existing) return [existing, false];

    const group = await this.treeRepo.save(
      this.treeRepo.create({
        name,
        category,
        tenant: { id: tenantId } as any,
        parent,
        privacy: GroupPrivacy.Public,
      }),
    );
    return [group, true];
  }

  private async ensureFellowshipSchedule(mcId: number, tenantId: number) {
    const existing = await this.scheduleRepo.findOne({
      where: { fellowshipGroupId: mcId },
    });
    if (!existing) {
      await this.scheduleRepo.save(
        this.scheduleRepo.create({
          tenant: { id: tenantId } as any,
          fellowshipGroup: { id: mcId } as any,
          fellowshipGroupId: mcId,
          meetingDay: 3,
          startTime: '19:00',
          frequency: 'weekly',
          isActive: true,
        }),
      );
    }
  }
}
