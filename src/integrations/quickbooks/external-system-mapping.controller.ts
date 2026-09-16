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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { ExternalSystemMappingService } from './external-system-mapping.service';
import {
  CreateMappingDto,
  UpdateMappingDto,
} from './dto/external-system-mapping.dto';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
// The global JwtAuthGuard only establishes who the caller is. These mappings
// decide which QuickBooks customer, account, item and class a gift posts
// against, so a wrong or deleted row sends real money to the wrong ledger line.
// Only the mutations are restricted; the read handlers are left as they were,
// since seeing the mappings is ordinary finance visibility and narrowing that
// would break screens that rely on it today.
@UseGuards(PermissionsGuard)
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
  @RequirePermissions(appPermissions.roleFinanceEdit)
  create(@Body() dto: CreateMappingDto) {
    return this.service.create(dto);
  }

  @Post('upsert')
  @RequirePermissions(appPermissions.roleFinanceEdit)
  upsert(@Body() dto: CreateMappingDto) {
    return this.service.upsert(dto);
  }

  @Put(':id')
  @RequirePermissions(appPermissions.roleFinanceEdit)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMappingDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(appPermissions.roleFinanceEdit)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
