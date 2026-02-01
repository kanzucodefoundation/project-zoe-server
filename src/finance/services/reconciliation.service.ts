import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection, In } from 'typeorm';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Transaction from '../entities/transaction.entity';
import Contact from '../../crm/entities/contact.entity';
import Group from '../../groups/entities/group.entity';
import {
  CreateMatchDto,
  UpdateMatchDto,
  BulkApproveMatchesDto,
  SearchMatchDto,
} from '../dto/reconciliation.dto';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';

@Injectable()
export class ReconciliationService {
  private readonly repository: Repository<ReconciliationMatch>;
  private readonly transactionRepository: Repository<Transaction>;
  private readonly contactRepository: Repository<Contact>;
  private readonly groupRepository: Repository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(ReconciliationMatch);
    this.transactionRepository = connection.getRepository(Transaction);
    this.contactRepository = connection.getRepository(Contact);
    this.groupRepository = connection.getRepository(Group);
    this.logger = this.appLogger.createContextLogger('ReconciliationService');
  }

  async createMatch(dto: CreateMatchDto, user: any): Promise<ReconciliationMatch> {
    const tenantId = this.tenantContext.requireTenant();

    const transaction = await this.transactionRepository.findOne({
      where: { id: dto.transactionId, tenant: { id: tenantId } },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${dto.transactionId} not found`,
      );
    }

    this.logger.business('log', 'Creating reconciliation match', {
      operation: 'createMatch',
      userId: user?.id,
      metadata: { transactionId: dto.transactionId, matchType: dto.matchType },
    });

    const match = new ReconciliationMatch();
    match.tenant = { id: tenantId } as any;
    match.transaction = transaction;
    match.matchType = dto.matchType;
    match.status = MatchStatus.PENDING;
    match.confidenceScore = dto.confidenceScore || 100;
    match.notes = dto.notes;

    if (dto.contactId) {
      const contact = await this.contactRepository.findOne({
        where: { id: dto.contactId, tenant: { id: tenantId } },
      });
      if (contact) {
        match.contact = contact;
      }
    }

    if (dto.groupId) {
      const group = await this.groupRepository.findOne({
        where: { id: dto.groupId },
      });
      if (group) {
        match.group = group;
      }
    }

    match.matchCriteria = {
      method: dto.matchType === MatchType.MANUAL ? 'manual' : 'auto',
    };

    return this.repository.save(match);
  }

  async updateMatch(dto: UpdateMatchDto, user: any): Promise<ReconciliationMatch> {
    const tenantId = this.tenantContext.requireTenant();

    const match = await this.repository.findOne({
      where: { id: dto.id, tenant: { id: tenantId } },
      relations: ['transaction'],
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${dto.id} not found`);
    }

    this.logger.business('log', 'Updating reconciliation match', {
      operation: 'updateMatch',
      userId: user?.id,
      resourceId: dto.id,
      resource: 'reconciliation_match',
    });

    if (dto.contactId !== undefined) {
      if (dto.contactId === null) {
        match.contact = null;
      } else {
        const contact = await this.contactRepository.findOne({
          where: { id: dto.contactId, tenant: { id: tenantId } },
        });
        if (contact) {
          match.contact = contact;
        }
      }
    }

    if (dto.groupId !== undefined) {
      if (dto.groupId === null) {
        match.group = null;
      } else {
        const group = await this.groupRepository.findOne({
          where: { id: dto.groupId },
        });
        if (group) {
          match.group = group;
        }
      }
    }

    if (dto.status !== undefined) {
      match.status = dto.status;

      if (dto.status === MatchStatus.APPROVED) {
        match.approvedBy = { id: user.id } as any;
        match.approvedAt = new Date();

        // Update transaction status
        match.transaction.status = TransactionStatus.RECONCILED;
        await this.transactionRepository.save(match.transaction);
      }
    }

    if (dto.notes !== undefined) {
      match.notes = dto.notes;
    }

    return this.repository.save(match);
  }

  async bulkApprove(
    dto: BulkApproveMatchesDto,
    user: any,
  ): Promise<{ approved: number; errors: string[] }> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Bulk approving matches', {
      operation: 'bulkApprove',
      userId: user?.id,
      metadata: { matchCount: dto.matchIds.length },
    });

    let approved = 0;
    const errors: string[] = [];

    for (const matchId of dto.matchIds) {
      try {
        const match = await this.repository.findOne({
          where: { id: matchId, tenant: { id: tenantId } },
          relations: ['transaction'],
        });

        if (!match) {
          errors.push(`Match ${matchId}: Not found`);
          continue;
        }

        if (match.status === MatchStatus.APPROVED) {
          continue;
        }

        match.status = MatchStatus.APPROVED;
        match.approvedBy = { id: user.id } as any;
        match.approvedAt = new Date();
        match.notes = dto.notes || match.notes;

        await this.repository.save(match);

        // Update transaction status
        match.transaction.status = TransactionStatus.RECONCILED;
        await this.transactionRepository.save(match.transaction);

        approved++;
      } catch (error) {
        errors.push(`Match ${matchId}: ${error.message}`);
      }
    }

    this.logger.business('log', 'Bulk approval completed', {
      operation: 'bulkApprove',
      userId: user?.id,
      metadata: { approved, errorCount: errors.length },
    });

    return { approved, errors };
  }

  async findMatches(dto: SearchMatchDto): Promise<ReconciliationMatch[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.transactionId) {
      where.transaction = { id: dto.transactionId };
    }

    if (dto.contactId) {
      where.contact = { id: dto.contactId };
    }

    if (dto.groupId) {
      where.group = { id: dto.groupId };
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.matchType) {
      where.matchType = dto.matchType;
    }

    return this.repository.find({
      where,
      relations: [
        'transaction',
        'transaction.account',
        'contact',
        'contact.person',
        'group',
        'approvedBy',
      ],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ReconciliationMatch> {
    const tenantId = this.tenantContext.requireTenant();

    const match = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: [
        'transaction',
        'transaction.account',
        'contact',
        'contact.person',
        'group',
        'approvedBy',
        'distributions',
      ],
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match;
  }
}
