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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from 'src/interceptors/tenant-context.interceptor';
import {
  GroupImportService,
  BulkGroupRow,
  BulkImportResult,
} from '../services/group-import.service';

const EXPECTED_HEADERS = ['location', 'zone', 'sector', 'mc'];

function parseCsv(buffer: Buffer): BulkGroupRow[] {
  const lines = buffer
    .toString('utf-8')
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim());

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  if (!headers.includes('location') || !headers.includes('mc')) {
    throw new Error(
      `CSV must include at minimum "location" and "mc" columns. Got: ${headers.join(
        ', ',
      )}`,
    );
  }

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row as BulkGroupRow;
  });
}

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Groups')
@Controller('api/groups/import')
export class GroupImportController {
  constructor(private readonly importService: GroupImportService) {}

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
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
