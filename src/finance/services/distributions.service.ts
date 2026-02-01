import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, Connection, In, Between } from 'typeorm';
import Distribution from '../entities/distribution.entity';
import DistributionBatch from '../entities/distribution-batch.entity';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import FinancialAccount from '../entities/financial-account.entity';
import Group from '../../groups/entities/group.entity';
import {
  CreateBatchDto,
  UpdateBatchDto,
  SearchBatchDto,
  CalculateDistributionsDto,
  SearchDistributionDto,
} from '../dto/distribution.dto';
import { BatchStatus } from '../enums/batch-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import { ReconciliationPluginRegistry } from '../plugins/reconciliation-plugin.registry';

@Injectable()
export class DistributionsService {
  private readonly distributionRepository: Repository<Distribution>;
  private readonly batchRepository: Repository<DistributionBatch>;
  private readonly matchRepository: Repository<ReconciliationMatch>;
  private readonly accountRepository: Repository<FinancialAccount>;
  private readonly groupRepository: Repository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private pluginRegistry: ReconciliationPluginRegistry,
  ) {
    this.distributionRepository = connection.getRepository(Distribution);
    this.batchRepository = connection.getRepository(DistributionBatch);
    this.matchRepository = connection.getRepository(ReconciliationMatch);
    this.accountRepository = connection.getRepository(FinancialAccount);
    this.groupRepository = connection.getRepository(Group);
    this.logger = this.appLogger.createContextLogger('DistributionsService');
  }

  async createBatch(dto: CreateBatchDto, user: any): Promise<DistributionBatch> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Creating distribution batch', {
      operation: 'createBatch',
      userId: user?.id,
      metadata: { batchName: dto.name },
    });

    const batch = new DistributionBatch();
    batch.tenant = { id: tenantId } as any;
    batch.name = dto.name;
    batch.status = BatchStatus.DRAFT;
    batch.periodStart = new Date(dto.periodStart);
    batch.periodEnd = new Date(dto.periodEnd);
    batch.description = dto.description;
    batch.createdBy = { id: user.id } as any;
    batch.totalAmount = 0;

    const savedBatch = await this.batchRepository.save(batch);

    // If match IDs provided, calculate distributions
    if (dto.matchIds && dto.matchIds.length > 0) {
      await this.calculateDistributions(
        { matchIds: dto.matchIds },
        savedBatch.id,
        user,
      );

      // Reload batch with updated total
      return this.batchRepository.findOne({
        where: { id: savedBatch.id },
        relations: ['distributions', 'createdBy'],
      });
    }

    return savedBatch;
  }

  async calculateDistributions(
    dto: CalculateDistributionsDto,
    batchId?: number,
    user?: any,
  ): Promise<Distribution[]> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Calculating distributions', {
      operation: 'calculateDistributions',
      userId: user?.id,
      metadata: { matchCount: dto.matchIds.length, batchId },
    });

    const plugin = dto.pluginId
      ? this.pluginRegistry.get(dto.pluginId)
      : this.pluginRegistry.getDefault();

    if (!plugin) {
      throw new BadRequestException('No distribution plugin available');
    }

    let batch: DistributionBatch | null = null;
    if (batchId) {
      batch = await this.batchRepository.findOne({
        where: { id: batchId, tenant: { id: tenantId } },
      });
    }

    const matches = await this.matchRepository.find({
      where: {
        id: In(dto.matchIds),
        tenant: { id: tenantId },
        status: MatchStatus.APPROVED,
      },
      relations: ['transaction', 'contact', 'group'],
    });

    const distributions: Distribution[] = [];
    let totalAmount = 0;

    for (const match of matches) {
      const amount = Number(match.transaction.amount);
      const category = match.transaction.category;

      const rules = await plugin.calculateDistributions(match, category, amount);

      for (const rule of rules) {
        const distribution = new Distribution();
        distribution.tenant = { id: tenantId } as any;
        distribution.match = match;
        distribution.category = category;
        distribution.percentage = rule.percentage;
        distribution.amount = (amount * rule.percentage) / 100;
        distribution.description = rule.description;

        if (batch) {
          distribution.batch = batch;
        }

        if (rule.targetType === 'group') {
          const group = await this.groupRepository.findOne({
            where: { id: rule.targetId },
          });
          if (group) {
            distribution.targetGroup = group;
          }
        } else if (rule.targetType === 'account') {
          const account = await this.accountRepository.findOne({
            where: { id: rule.targetId, tenant: { id: tenantId } },
          });
          if (account) {
            distribution.targetAccount = account;
          }
        }

        const saved = await this.distributionRepository.save(distribution);
        distributions.push(saved);
        totalAmount += distribution.amount;
      }
    }

    // Update batch total if applicable
    if (batch) {
      batch.totalAmount = totalAmount;
      await this.batchRepository.save(batch);
    }

    return distributions;
  }

  async findBatches(dto: SearchBatchDto): Promise<DistributionBatch[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.startDate && dto.endDate) {
      where.periodStart = Between(new Date(dto.startDate), new Date(dto.endDate));
    }

    return this.batchRepository.find({
      where,
      relations: ['createdBy', 'approvedBy', 'executedBy'],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneBatch(id: number): Promise<DistributionBatch> {
    const tenantId = this.tenantContext.requireTenant();

    const batch = await this.batchRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: [
        'createdBy',
        'approvedBy',
        'executedBy',
        'distributions',
        'distributions.match',
        'distributions.targetGroup',
        'distributions.targetAccount',
      ],
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }

    return batch;
  }

  async updateBatch(dto: UpdateBatchDto, user: any): Promise<DistributionBatch> {
    const tenantId = this.tenantContext.requireTenant();

    const batch = await this.batchRepository.findOne({
      where: { id: dto.id, tenant: { id: tenantId } },
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${dto.id} not found`);
    }

    this.logger.business('log', 'Updating distribution batch', {
      operation: 'updateBatch',
      userId: user?.id,
      resourceId: dto.id,
      resource: 'distribution_batch',
    });

    if (dto.name !== undefined) batch.name = dto.name;
    if (dto.periodStart !== undefined) batch.periodStart = new Date(dto.periodStart);
    if (dto.periodEnd !== undefined) batch.periodEnd = new Date(dto.periodEnd);
    if (dto.description !== undefined) batch.description = dto.description;

    if (dto.status !== undefined) {
      batch.status = dto.status;

      if (dto.status === BatchStatus.APPROVED) {
        batch.approvedBy = { id: user.id } as any;
        batch.approvedAt = new Date();
      } else if (dto.status === BatchStatus.EXECUTED) {
        batch.executedBy = { id: user.id } as any;
        batch.executedAt = new Date();
      }
    }

    return this.batchRepository.save(batch);
  }

  async approveBatch(id: number, user: any): Promise<DistributionBatch> {
    return this.updateBatch(
      { id, status: BatchStatus.APPROVED },
      user,
    );
  }

  async executeBatch(id: number, user: any): Promise<DistributionBatch> {
    const batch = await this.findOneBatch(id);

    if (batch.status !== BatchStatus.APPROVED) {
      throw new BadRequestException('Batch must be approved before execution');
    }

    this.logger.business('log', 'Executing distribution batch', {
      operation: 'executeBatch',
      userId: user?.id,
      resourceId: id,
      resource: 'distribution_batch',
      metadata: { totalAmount: batch.totalAmount },
    });

    return this.updateBatch(
      { id, status: BatchStatus.EXECUTED },
      user,
    );
  }

  async findDistributions(dto: SearchDistributionDto): Promise<Distribution[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.batchId) {
      where.batch = { id: dto.batchId };
    }

    if (dto.matchId) {
      where.match = { id: dto.matchId };
    }

    if (dto.targetGroupId) {
      where.targetGroup = { id: dto.targetGroupId };
    }

    if (dto.category) {
      where.category = dto.category;
    }

    return this.distributionRepository.find({
      where,
      relations: ['match', 'batch', 'targetGroup', 'targetAccount'],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { createdAt: 'DESC' },
    });
  }
}
