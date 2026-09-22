import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import {
  GivingCategoriesService,
  GivingCategoryDto,
} from '../services/giving-categories.service';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Giving Categories')
@UseGuards(PermissionsGuard)
@Controller('api/finance/giving-categories')
export class GivingCategoriesController {
  constructor(private readonly service: GivingCategoriesService) {}

  /** Giving categories with the QuickBooks item each one posts to. */
  @RequirePermissions(appPermissions.roleFinanceView)
  @Get()
  async findAll(): Promise<GivingCategoryDto[]> {
    return this.service.list();
  }
}
