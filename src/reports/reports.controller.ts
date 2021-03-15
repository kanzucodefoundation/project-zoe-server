import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('api/reports/report')
export class ReportsController {}
