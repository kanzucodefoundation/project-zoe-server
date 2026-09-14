import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import {
  GivingCategoriesService,
  GivingCategoryDto,
} from '../services/giving-categories.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Giving Categories')
@Controller('api/finance/giving-categories')
export class GivingCategoriesController {
  constructor(private readonly service: GivingCategoriesService) {}

  /** Giving categories with the QuickBooks item each one posts to. */
  @Get()
  async findAll(): Promise<GivingCategoryDto[]> {
    return this.service.list();
  }
}
