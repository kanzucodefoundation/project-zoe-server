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

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Category Rules')
@Controller('api/finance/category-rules')
export class CategoryRulesController {
  constructor(private readonly service: CategoryRulesService) {}

  @Get()
  async findAll(@Query() query: SearchCategoryRuleDto): Promise<CategoryRule[]> {
    return this.service.findAll(query);
  }

  @Post()
  async create(
    @Body() data: CreateCategoryRuleDto,
    @Request() req: any,
  ): Promise<CategoryRule> {
    return this.service.create(data, req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<CategoryRule> {
    return this.service.findOne(id);
  }

  @Put()
  async update(
    @Body() data: UpdateCategoryRuleDto,
    @Request() req: any,
  ): Promise<CategoryRule> {
    return this.service.update(data, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: any): Promise<void> {
    return this.service.remove(id, req.user);
  }
}
