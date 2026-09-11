import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import {
  ExternalSystemMappingService,
  CreateMappingDto,
  UpdateMappingDto,
} from './external-system-mapping.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('External System Mappings')
@Controller('api/integrations/mappings')
export class ExternalSystemMappingController {
  constructor(private readonly service: ExternalSystemMappingService) {}

  @Get()
  findAll(@Query('system') system?: string) {
    return this.service.findAll(system);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMappingDto) {
    return this.service.create(dto);
  }

  @Post('upsert')
  upsert(@Body() dto: CreateMappingDto) {
    return this.service.upsert(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMappingDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
