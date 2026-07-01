import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { parse } from 'csv-parse/sync';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from 'src/interceptors/tenant-context.interceptor';
import {
  GroupImportService,
  BulkGroupRow,
  BulkImportResult,
} from '../services/group-import.service';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

function csvFileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) {
  const isCsv =
    file.originalname.toLowerCase().endsWith('.csv') ||
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/csv';
  cb(
    isCsv ? null : new BadRequestException('Only CSV files are accepted.'),
    isCsv,
  );
}

function parseCsv(buffer: Buffer): BulkGroupRow[] {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  if (records.length === 0) return [];

  const headers = Object.keys(records[0]).map((h) => h.toLowerCase());
  if (!headers.includes('location') || !headers.includes('mc')) {
    throw new Error(
      `CSV must include at minimum "location" and "mc" columns. Got: ${headers.join(
        ', ',
      )}`,
    );
  }

  return records.map((rec) => {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) lower[k.toLowerCase()] = v;
    return {
      location: lower['location'] ?? '',
      zone: lower['zone'] ?? '',
      sector: lower['sector'] ?? '',
      mc: lower['mc'] ?? '',
    };
  });
}

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Groups')
@Controller('api/groups/import')
export class GroupImportController {
  constructor(private readonly importService: GroupImportService) {}

  @Post('bulk')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CSV_BYTES },
      fileFilter: csvFileFilter,
    }),
  )
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BulkImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    let rows: BulkGroupRow[];
    try {
      rows = parseCsv(file.buffer);
    } catch (err) {
      throw new BadRequestException(err.message);
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'CSV has no data rows. Expected columns: location,zone,sector,mc (zone and sector are optional)',
      );
    }

    return this.importService.bulkImport(rows);
  }
}
