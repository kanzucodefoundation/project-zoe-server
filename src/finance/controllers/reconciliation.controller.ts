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
import { ReconciliationService } from '../services/reconciliation.service';
import { MatchingService } from '../services/matching.service';
import {
  CreateMatchDto,
  UpdateMatchDto,
  BulkApproveMatchesDto,
  SearchMatchDto,
  RunMatchingDto,
} from '../dto/reconciliation.dto';
import ReconciliationMatch from '../entities/reconciliation-match.entity';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Reconciliation')
@Controller('api/finance/reconciliation')
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly matchingService: MatchingService,
  ) {}

  @Post('run')
  async runMatching(
    @Body() data: RunMatchingDto,
    @Request() req: any,
  ): Promise<{
    processed: number;
    matched: number;
    autoApproved: number;
    errors: string[];
  }> {
    return this.matchingService.runMatching(
      data.accountId,
      data.minConfidenceThreshold,
      data.autoApproveAboveThreshold,
      data.pluginId,
      req.user,
    );
  }

  @Post('matches')
  async createMatch(
    @Body() data: CreateMatchDto,
    @Request() req: any,
  ): Promise<ReconciliationMatch> {
    return this.reconciliationService.createMatch(data, req.user);
  }

  @Put('matches')
  async updateMatch(
    @Body() data: UpdateMatchDto,
    @Request() req: any,
  ): Promise<ReconciliationMatch> {
    return this.reconciliationService.updateMatch(data, req.user);
  }

  @Post('bulk-approve')
  async bulkApprove(
    @Body() data: BulkApproveMatchesDto,
    @Request() req: any,
  ): Promise<{ approved: number; errors: string[] }> {
    return this.reconciliationService.bulkApprove(data, req.user);
  }

  @Get('matches')
  async findMatches(
    @Query() query: SearchMatchDto,
  ): Promise<ReconciliationMatch[]> {
    return this.reconciliationService.findMatches(query);
  }

  @Get('matches/:id')
  async findOneMatch(@Param('id') id: number): Promise<ReconciliationMatch> {
    return this.reconciliationService.findOne(id);
  }
}
