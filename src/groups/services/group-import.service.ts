import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Connection, EntityManager, QueryRunner, Repository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupCategory from '../entities/groupCategory.entity';
import { GroupPrivacy } from '../enums/groupPrivacy';
import { GroupCategoryNames } from '../enums/groups';
import { TenantContext } from 'src/shared/tenant/tenant-context';
import { FellowshipSchedule } from 'src/attendance/entities/fellowship-schedule.entity';

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

interface RowCounts {
  zones: { created: number; skipped: number };
  sectors: { created: number; skipped: number };
  mcs: { created: number; skipped: number };
}

@Injectable()
export class GroupImportService {
  private readonly categoryRepo: Repository<GroupCategory>;

  constructor(
    @Inject('CONNECTION') private readonly connection: Connection,
    private readonly tenantContext: TenantContext,
  ) {
    this.categoryRepo = connection.getRepository(GroupCategory);
  }

  async bulkImport(rows: BulkGroupRow[]): Promise<BulkImportResult> {
    const tenantId = this.tenantContext.requireTenant();

    const [locationCat, zoneCat, sectorCat, mcCat] = await Promise.all([
      this.findCategory(GroupCategoryNames.LOCATION, tenantId),
      this.findCategory(GroupCategoryNames.ZONE, tenantId),
      this.findCategory('Sector', tenantId),
      this.findCategory(GroupCategoryNames.MC, tenantId),
    ]);

    if (!locationCat) {
      throw new BadRequestException(
        `"${GroupCategoryNames.LOCATION}" category not found for this tenant.`,
      );
    }
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
      const rowNum = index + 2; // 1-based + header row
      const qr = this.connection.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const counts = await this.processRow(
          row,
          locationCat,
          zoneCat,
          sectorCat,
          mcCat,
          tenantId,
          qr,
        );
        await qr.commitTransaction();
        result.created.zones += counts.zones.created;
        result.created.sectors += counts.sectors.created;
        result.created.mcs += counts.mcs.created;
        result.skipped.zones += counts.zones.skipped;
        result.skipped.sectors += counts.sectors.skipped;
        result.skipped.mcs += counts.mcs.skipped;
      } catch (err) {
        await qr.rollbackTransaction();
        result.errors.push(`Row ${rowNum}: ${err.message}`);
      } finally {
        await qr.release();
      }
    }

    return result;
  }

  private async processRow(
    row: BulkGroupRow,
    locationCat: GroupCategory,
    zoneCat: GroupCategory | null,
    sectorCat: GroupCategory | null,
    mcCat: GroupCategory,
    tenantId: number,
    qr: QueryRunner,
  ): Promise<RowCounts> {
    const counts: RowCounts = {
      zones: { created: 0, skipped: 0 },
      sectors: { created: 0, skipped: 0 },
      mcs: { created: 0, skipped: 0 },
    };

    const locationName = row.location?.trim();
    const mcName = row.mc?.trim();

    if (!locationName) throw new Error('"location" is required.');
    if (!mcName) throw new Error('"mc" is required.');

    const location = await this.findByName(
      locationName,
      locationCat,
      tenantId,
      qr.manager,
    );
    if (!location) {
      throw new Error(
        `Location "${locationName}" not found. Locations must already exist.`,
      );
    }

    let parent = location;

    if (row.zone?.trim()) {
      if (!zoneCat) {
        throw new Error(
          `Zone category ("${GroupCategoryNames.ZONE}") not found for this tenant.`,
        );
      }
      const [zone, wasCreated] = await this.findOrCreate(
        row.zone.trim(),
        zoneCat,
        tenantId,
        parent,
        qr,
      );
      wasCreated ? counts.zones.created++ : counts.zones.skipped++;
      parent = zone;
    }

    if (row.sector?.trim()) {
      if (!sectorCat) {
        throw new Error('Sector category not found for this tenant.');
      }
      const [sector, wasCreated] = await this.findOrCreate(
        row.sector.trim(),
        sectorCat,
        tenantId,
        parent,
        qr,
      );
      wasCreated ? counts.sectors.created++ : counts.sectors.skipped++;
      parent = sector;
    }

    const [mc, wasCreated] = await this.findOrCreate(
      mcName,
      mcCat,
      tenantId,
      parent,
      qr,
    );
    if (wasCreated) {
      counts.mcs.created++;
      await this.ensureFellowshipSchedule(mc.id, tenantId, qr.manager);
    } else {
      counts.mcs.skipped++;
    }

    return counts;
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
    category: GroupCategory,
    tenantId: number,
    manager: EntityManager,
  ): Promise<Group | null> {
    return manager
      .getRepository(Group)
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('LOWER(g.name) = LOWER(:name)', { name })
      .getOne();
  }

  // Uses SAVEPOINT so a unique-constraint violation from a concurrent insert
  // doesn't abort the outer transaction — we roll back only the failed INSERT,
  // then re-find the row that the competing writer just committed.
  private async findOrCreate(
    name: string,
    category: GroupCategory,
    tenantId: number,
    parent: Group,
    qr: QueryRunner,
  ): Promise<[Group, boolean]> {
    const groupRepo = qr.manager.getRepository(Group);

    const existing = await groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('LOWER(g.name) = LOWER(:name)', { name })
      .andWhere('g."parentId" = :parentId', { parentId: parent.id })
      .getOne();

    if (existing) return [existing, false];

    const sp = `sp_foi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await qr.manager.query(`SAVEPOINT "${sp}"`);
    try {
      const treeRepo = qr.manager.getTreeRepository(Group);
      const group = await treeRepo.save(
        treeRepo.create({
          name,
          category,
          tenant: { id: tenantId } as any,
          parent,
          privacy: GroupPrivacy.Public,
        }),
      );
      return [group, true];
    } catch (err) {
      if ((err as any).code === '23505') {
        await qr.manager.query(`ROLLBACK TO SAVEPOINT "${sp}"`);
        const concurrent = await groupRepo
          .createQueryBuilder('g')
          .where('g."tenantId" = :tenantId', { tenantId })
          .andWhere('g."categoryId" = :catId', { catId: category.id })
          .andWhere('g.name = :name', { name })
          .andWhere('g."parentId" = :parentId', { parentId: parent.id })
          .getOne();
        if (concurrent) return [concurrent, false];
      }
      throw err;
    }
  }

  private async ensureFellowshipSchedule(
    mcId: number,
    tenantId: number,
    manager: EntityManager,
  ) {
    const scheduleRepo = manager.getRepository(FellowshipSchedule);
    const existing = await scheduleRepo.findOne({
      where: { fellowshipGroupId: mcId },
    });
    if (!existing) {
      await scheduleRepo.save(
        scheduleRepo.create({
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
