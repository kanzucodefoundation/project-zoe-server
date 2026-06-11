import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { Report } from 'src/reports/entities/report.entity';
import {
  ReportField,
  FieldType,
} from 'src/reports/entities/report.field.entity';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { GroupCategoryPurpose } from 'src/groups/enums/groups';
import { ReportStatus } from 'src/reports/enums/report.enum';

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hidden?: boolean;
  options?: any[];
}

interface ReportDef {
  name: string;
  description: string;
  submissionFrequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  functionName?: string;
  targetCategoryPurpose: GroupCategoryPurpose;
  targetCategoryName: string;
  fields: FieldDef[];
}

const LOCATION_SELECTOR = [
  { type: 'dynamic_group_selector', scope: 'user', group_category: 'location' },
];

const WHM_REPORTS: ReportDef[] = [
  {
    name: 'Sunday Service Report',
    description: 'Weekly Sunday service attendance by slot for a Location',
    submissionFrequency: 'weekly',
    functionName: 'whmSundayService',
    targetCategoryPurpose: GroupCategoryPurpose.LOCATION,
    targetCategoryName: 'Location',
    fields: [
      // Location linkage — required; serviceLocationId is always hidden (system field)
      {
        name: 'serviceLocationName',
        label: 'Location Name',
        type: FieldType.SELECT,
        required: true,
        hidden: false,
        options: LOCATION_SELECTOR,
      },
      {
        name: 'serviceLocationId',
        label: 'Location ID',
        type: FieldType.SELECT,
        required: true,
        hidden: true,
        options: LOCATION_SELECTOR,
      },
      // Attendance slots — required (core record)
      {
        name: '1Sv',
        label: '1st Service',
        type: FieldType.NUMBER,
        required: true,
      },
      {
        name: '2Sv',
        label: '2nd Service',
        type: FieldType.NUMBER,
        required: true,
      },
      {
        name: 'YXP',
        label: 'Youth Xperience',
        type: FieldType.NUMBER,
        required: true,
      },
      { name: 'kids', label: 'Kids', type: FieldType.NUMBER, required: true },
      // PGA = 1Sv + 2Sv + YXP + kids — computed by backend, hidden from submission form
      { name: 'pga', label: 'PGA', type: FieldType.NUMBER, hidden: true },
      // Optional slots
      { name: 'local', label: 'Local Language', type: FieldType.NUMBER },
      { name: 'hc1', label: 'HC 1', type: FieldType.NUMBER },
      { name: 'hc2', label: 'HC 2', type: FieldType.NUMBER },
      { name: 'hc3', label: 'HC 3', type: FieldType.NUMBER },
      { name: 'alc', label: 'ALC', type: FieldType.NUMBER },
      { name: 'ftg', label: 'FTG', type: FieldType.NUMBER },
      // Community metrics
      { name: 'mca', label: 'MC Attendance', type: FieldType.NUMBER },
      { name: 'salvations', label: 'Salvations', type: FieldType.NUMBER },
      { name: 'baptisms', label: 'Baptisms', type: FieldType.NUMBER },
      // Logistics
      { name: 'mechanics', label: 'Mechanics', type: FieldType.NUMBER },
      { name: 'carsParked', label: 'Cars Parked', type: FieldType.NUMBER },
      { name: 'bussedPax', label: 'Bussed In', type: FieldType.NUMBER },
    ],
  },
  {
    name: 'Weekly Oikos Report',
    description: 'Weekly Missional Community activity for a Zone',
    submissionFrequency: 'weekly',
    targetCategoryPurpose: GroupCategoryPurpose.STRUCTURE,
    targetCategoryName: 'Zone',
    fields: [
      { name: 'mcs', label: 'MCs Running', type: FieldType.NUMBER },
      { name: 'mcm', label: 'MC Members', type: FieldType.NUMBER },
      { name: 'mca', label: 'MC Attendance', type: FieldType.NUMBER },
      { name: 'salvations', label: 'Salvations', type: FieldType.NUMBER },
      { name: 'baptisms', label: 'Baptisms', type: FieldType.NUMBER },
      { name: 'visitations', label: 'Visitations', type: FieldType.NUMBER },
    ],
  },
  {
    name: 'Annual Salvations & Baptisms',
    description:
      'Annual cumulative salvations and baptisms per Location (Champions Network)',
    submissionFrequency: 'custom',
    targetCategoryPurpose: GroupCategoryPurpose.LOCATION,
    targetCategoryName: 'Location',
    fields: [
      { name: 'salvations', label: 'Salvations', type: FieldType.NUMBER },
      { name: 'baptisms', label: 'Baptisms', type: FieldType.NUMBER },
    ],
  },
  {
    name: 'Monthly Location Categorization',
    description: 'Monthly A–G grade and health metrics for a Location',
    submissionFrequency: 'monthly',
    functionName: 'locationCategorization',
    targetCategoryPurpose: GroupCategoryPurpose.LOCATION,
    targetCategoryName: 'Location',
    fields: [
      {
        name: 'grade',
        label: 'Grade',
        type: FieldType.SELECT,
        options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      { name: 'rank', label: 'Rank', type: FieldType.NUMBER },
      { name: 'pga', label: 'PGA', type: FieldType.NUMBER },
      { name: 'mca', label: 'MCA', type: FieldType.NUMBER },
      { name: 'mcs', label: 'MCS', type: FieldType.NUMBER },
      { name: 'mission', label: 'Mission Score', type: FieldType.NUMBER },
      {
        name: 'missionLabel',
        label: 'Mission Label',
        type: FieldType.TEXT,
        hidden: true,
      },
      { name: 'plants', label: 'Plants', type: FieldType.NUMBER },
      { name: 'opsInc', label: 'Ops Income', type: FieldType.NUMBER },
      { name: 'fts', label: 'FTS', type: FieldType.NUMBER },
      {
        name: 'criteriaBreakdown',
        label: 'Criteria Breakdown',
        type: FieldType.TEXT,
        hidden: true,
      },
      { name: 'healthScore', label: 'Health Score', type: FieldType.NUMBER },
    ],
  },
];

@Injectable()
export class WhmReportsSeedService {
  private reportRepo: Repository<Report>;
  private fieldRepo: Repository<ReportField>;
  private categoryRepo: Repository<GroupCategory>;
  private tenantRepo: Repository<Tenant>;

  constructor(@InjectConnection() private connection: Connection) {}

  private init(): void {
    this.reportRepo = this.connection.getRepository(Report);
    this.fieldRepo = this.connection.getRepository(ReportField);
    this.categoryRepo = this.connection.getRepository(GroupCategory);
    this.tenantRepo = this.connection.getRepository(Tenant);
  }

  async seedReports(): Promise<void> {
    this.init();
    Logger.log('📊 [WHM] Seeding WHM report templates...');

    const tenant = await this.tenantRepo.findOne({
      where: { name: 'worshipharvest' },
    });
    if (!tenant) {
      throw new Error('WHM tenant not found — run base seed first');
    }

    for (const def of WHM_REPORTS) {
      const existing = await this.reportRepo.findOne({
        where: { name: def.name, tenant: { id: tenant.id } },
        relations: ['fields'],
      });
      if (existing) {
        const expectedFunctionName = def.functionName ?? null;
        if (existing.functionName !== expectedFunctionName) {
          existing.functionName = expectedFunctionName;
          await this.reportRepo.save(existing);
          Logger.log(
            `[WHM] Corrected functionName for: ${def.name} -> ${expectedFunctionName}`,
          );
        }

        const existingFieldNames = (existing.fields ?? [])
          .map((f) => f.name)
          .sort()
          .join(',');
        const expectedFieldNames = def.fields
          .map((f) => f.name)
          .sort()
          .join(',');
        if (existingFieldNames === expectedFieldNames) {
          Logger.log(`[WHM] Report up to date, skipping: ${def.name}`);
          continue;
        }
        Logger.log(
          `[WHM] Report exists with wrong fields — replacing: ${def.name}`,
        );
        await this.fieldRepo.delete({ report: { id: existing.id } });
        for (const f of def.fields) {
          const field = new ReportField();
          field.name = f.name;
          field.label = f.label;
          field.type = f.type;
          field.required = f.required ?? false;
          field.hidden = f.hidden ?? false;
          field.options = f.options ?? null;
          field.report = existing;
          await this.fieldRepo.save(field);
        }
        Logger.log(
          `[WHM] Updated fields for: ${def.name} (${def.fields.length} fields)`,
        );
        continue;
      }

      const category = await this.categoryRepo.findOne({
        where: { name: def.targetCategoryName, tenant: { id: tenant.id } },
      });
      if (!category) {
        Logger.warn(
          `[WHM] Category '${def.targetCategoryName}' not found — skipping report: ${def.name}`,
        );
        continue;
      }

      const report = new Report();
      report.name = def.name;
      report.description = def.description;
      report.submissionFrequency = def.submissionFrequency;
      report.functionName = def.functionName ?? null;
      report.targetGroupCategory = category;
      report.tenant = tenant;
      report.active = true;
      report.status = ReportStatus.ACTIVE;
      report.viewType = 'table';
      await this.reportRepo.save(report);

      for (const f of def.fields) {
        const field = new ReportField();
        field.name = f.name;
        field.label = f.label;
        field.type = f.type;
        field.required = f.required ?? false;
        field.hidden = f.hidden ?? false;
        field.options = f.options ?? null;
        field.report = report;
        await this.fieldRepo.save(field);
      }

      Logger.log(
        `[WHM] Created report: ${def.name} (${def.fields.length} fields)`,
      );
    }

    Logger.log('✅ [WHM] Report templates seeded.');
  }
}
