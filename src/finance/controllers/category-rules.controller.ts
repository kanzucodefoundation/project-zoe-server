import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { CategoryRulesService } from '../services/category-rules.service';
import {
  CreateCategoryRuleDto,
  UpdateCategoryRuleDto,
  SearchCategoryRuleDto,
} from '../dto/category-rule.dto';
import CategoryRule from '../entities/category-rule.entity';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Category Rules')
@UseGuards(PermissionsGuard)
@Controller('api/finance/category-rules')
export class CategoryRulesController {
  constructor(private readonly service: CategoryRulesService) {}

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get()
  async findAll(
    @Query() query: SearchCategoryRuleDto,
  ): Promise<CategoryRule[]> {
    return this.service.findAll(query);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post()
  async create(
    @Body() data: CreateCategoryRuleDto,
    @Request() req: any,
  ): Promise<CategoryRule> {
    return this.service.create(data, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get(':id')
  async findOne(@Param('id') id: number): Promise<CategoryRule> {
    return this.service.findOne(id);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Put()
  async update(
    @Body() data: UpdateCategoryRuleDto,
    @Request() req: any,
  ): Promise<CategoryRule> {
    return this.service.update(data, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: any): Promise<void> {
    return this.service.remove(id, req.user);
  }
}
