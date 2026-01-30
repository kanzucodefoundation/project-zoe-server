import {
  Body,
  Controller,
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

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Distributions')
@Controller('api/finance/distributions')
export class DistributionsController {
  constructor(private readonly service: DistributionsService) {}

  @Post('batches')
  async createBatch(
    @Body() data: CreateBatchDto,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.createBatch(data, req.user);
  }

  @Get('batches')
  async findBatches(@Query() query: SearchBatchDto): Promise<DistributionBatch[]> {
    return this.service.findBatches(query);
  }

  @Get('batches/:id')
  async findOneBatch(@Param('id') id: number): Promise<DistributionBatch> {
    return this.service.findOneBatch(id);
  }

  @Put('batches')
  async updateBatch(
    @Body() data: UpdateBatchDto,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.updateBatch(data, req.user);
  }

  @Post('batches/:id/approve')
  async approveBatch(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.approveBatch(id, req.user);
  }

  @Post('batches/:id/execute')
  async executeBatch(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<DistributionBatch> {
    return this.service.executeBatch(id, req.user);
  }

  @Post('calculate')
  async calculateDistributions(
    @Body() data: CalculateDistributionsDto,
    @Request() req: any,
  ): Promise<Distribution[]> {
    return this.service.calculateDistributions(data, undefined, req.user);
  }

  @Get()
  async findDistributions(
    @Query() query: SearchDistributionDto,
  ): Promise<Distribution[]> {
    return this.service.findDistributions(query);
  }
}
