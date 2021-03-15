import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reports Categories')
@Controller('api/reports/category')

export class ReportsCategoriesController {}