import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection, ILike } from 'typeorm';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  SearchFinancialAccountDto,
} from '../dto/financial-account.dto';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import Group from '../../groups/entities/group.entity';

@Injectable()
export class AccountsService {
  private readonly repository: Repository<FinancialAccount>;
  private readonly groupRepository: Repository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(FinancialAccount);
    this.groupRepository = connection.getRepository(Group);
    this.logger = this.appLogger.createContextLogger('AccountsService');
  }

  async create(dto: CreateFinancialAccountDto, user: any): Promise<FinancialAccount> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Creating financial account', {
      operation: 'createAccount',
      userId: user?.id,
      metadata: { accountName: dto.name, accountType: dto.accountType },
    });

    const account = new FinancialAccount();
    account.tenant = { id: tenantId } as any;
    account.name = dto.name;
    account.accountNumber = dto.accountNumber;
    account.accountType = dto.accountType;
    account.currency = dto.currency || 'UGX';
    account.description = dto.description;
    account.isActive = true;

    if (dto.ownerGroupId) {
      const group = await this.groupRepository.findOne({
        where: { id: dto.ownerGroupId },
      });
      if (group) {
        account.ownerGroup = group;
      }
    }

    const saved = await this.repository.save(account);

    this.logger.business('log', 'Financial account created', {
      operation: 'createAccount',
      userId: user?.id,
      resourceId: saved.id,
      resource: 'financial_account',
    });

    return saved;
  }

  async findAll(dto: SearchFinancialAccountDto): Promise<FinancialAccount[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.query) {
      where.name = ILike(`%${dto.query}%`);
    }

    if (dto.accountType) {
      where.accountType = dto.accountType;
    }

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    if (dto.ownerGroupId) {
      where.ownerGroup = { id: dto.ownerGroupId };
    }

    return this.repository.find({
      where,
      relations: ['ownerGroup'],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<FinancialAccount> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['ownerGroup'],
    });

    if (!account) {
      throw new NotFoundException(`Financial account with ID ${id} not found`);
    }

    return account;
  }

  async update(dto: UpdateFinancialAccountDto, user: any): Promise<FinancialAccount> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.repository.findOne({
      where: { id: dto.id, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(`Financial account with ID ${dto.id} not found`);
    }

    this.logger.business('log', 'Updating financial account', {
      operation: 'updateAccount',
      userId: user?.id,
      resourceId: dto.id,
      resource: 'financial_account',
    });

    if (dto.name !== undefined) account.name = dto.name;
    if (dto.accountNumber !== undefined) account.accountNumber = dto.accountNumber;
    if (dto.accountType !== undefined) account.accountType = dto.accountType;
    if (dto.currency !== undefined) account.currency = dto.currency;
    if (dto.description !== undefined) account.description = dto.description;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;

    if (dto.ownerGroupId !== undefined) {
      if (dto.ownerGroupId === null) {
        account.ownerGroup = null;
      } else {
        const group = await this.groupRepository.findOne({
          where: { id: dto.ownerGroupId },
        });
        if (group) {
          account.ownerGroup = group;
        }
      }
    }

    return this.repository.save(account);
  }

  async remove(id: number, user: any): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(`Financial account with ID ${id} not found`);
    }

    this.logger.business('log', 'Deleting financial account', {
      operation: 'deleteAccount',
      userId: user?.id,
      resourceId: id,
      resource: 'financial_account',
    });

    await this.repository.remove(account);
  }
}
