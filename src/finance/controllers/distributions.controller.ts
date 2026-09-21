import {
  Body,
  Controller,
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
import { DistributionsService } from '../services/distributions.service';
import {
  CreateBatchDto,
  UpdateBatchDto,
  SearchBatchDto,
  CalculateDistributionsDto,
  SearchDistributionDto,
} from '../dto/distribution.dto';
import DistributionBatch from '../entities/distribution-batch.entity';
import Distribution from '../entities/distribution.entity';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { appPermissions } from '../../auth/constants';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Distributions')
@UseGuards(PermissionsGuard)
@Controller('api/finance/distributions')
export class DistributionsController {
  constructor(private readonly service: DistributionsService) {}

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('batches')
  async createBatch(
    @Body() data: CreateBatchDto,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.createBatch(data, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('batches')
  async findBatches(
    @Query() query: SearchBatchDto,
  ): Promise<DistributionBatch[]> {
    return this.service.findBatches(query);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get('batches/:id')
  async findOneBatch(@Param('id') id: number): Promise<DistributionBatch> {
    return this.service.findOneBatch(id);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Put('batches')
  async updateBatch(
    @Body() data: UpdateBatchDto,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.updateBatch(data, req.user);
  }

  /** Move a draft batch into the approval queue. */
  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('batches/:id/submit')
  async submitBatch(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.submitBatch(id, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('batches/:id/approve')
  async approveBatch(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.approveBatch(id, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('batches/:id/execute')
  async executeBatch(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.executeBatch(id, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceEdit)
  @Post('calculate')
  async calculateDistributions(
    @Body() data: CalculateDistributionsDto,
    @Request() req: any,
  ): Promise<Distribution[]> {
    return this.service.calculateDistributions(data, undefined, req.user);
  }

  @RequirePermissions(appPermissions.roleFinanceView)
  @Get()
  async findDistributions(
    @Query() query: SearchDistributionDto,
  ): Promise<Distribution[]> {
    return this.service.findDistributions(query);
  }
}
