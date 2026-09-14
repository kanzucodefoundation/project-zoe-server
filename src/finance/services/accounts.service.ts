import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository, Connection, ILike } from 'typeorm';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateAccountFromQuickBooksDto,
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  SearchFinancialAccountDto,
} from '../dto/financial-account.dto';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import Group from '../../groups/entities/group.entity';
import { QuickBooksService } from '../../integrations/quickbooks/quickbooks.service';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { ACCOUNTING_SYSTEM } from '../constants/accounting-mapping.constants';
import { QboAccount } from '../../integrations/quickbooks/quickbooks.types';

/** A QuickBooks account offered on the accounts screen. */
export interface QboAccountOption {
  id: string;
  name: string;
  accountType: string | null;
  currency: string | null;
  /** Set when a Zoe account is already linked to this QuickBooks account. */
  linkedAccountId: number | null;
  linkedAccountName: string | null;
}

@Injectable()
export class AccountsService {
  private readonly repository: Repository<FinancialAccount>;
  private readonly groupRepository: Repository<Group>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private readonly qbService: QuickBooksService,
    private readonly mappingService: ExternalSystemMappingService,
  ) {
    this.repository = connection.getRepository(FinancialAccount);
    this.groupRepository = connection.getRepository(Group);
    this.logger = this.appLogger.createContextLogger('AccountsService');
  }

  /**
   * The QuickBooks chart of accounts, annotated with the Zoe account already
   * linked to each one. Drives the "add from QuickBooks" picker so the operator
   * chooses a real account instead of retyping its name and hoping it matches.
   */
  async listQuickBooksAccounts(): Promise<QboAccountOption[]> {
    const tenantId = this.tenantContext.requireTenant();

    const [qboAccounts, mappings, localAccounts] = await Promise.all([
      this.qbService.getQboAccounts(tenantId),
      this.mappingService.findAll(ACCOUNTING_SYSTEM),
      this.repository.find({ where: { tenant: { id: tenantId } } }),
    ]);

    const accountsById = new Map(localAccounts.map((a) => [a.id, a]));
    const linkedByExternalId = new Map<string, FinancialAccount | undefined>();
    for (const mapping of mappings) {
      if (
        mapping.internalReferenceType === 'FINANCIAL_ACCOUNT' &&
        mapping.externalReferenceType === 'ACCOUNT'
      ) {
        linkedByExternalId.set(
          mapping.externalReferenceId,
          accountsById.get(Number(mapping.internalReferenceId)),
        );
      }
    }

    return qboAccounts.map((account) => {
      const linked = linkedByExternalId.get(String(account.Id));
      return {
        id: String(account.Id),
        name: account.Name,
        accountType: account.AccountType ?? null,
        currency: account.CurrencyRef?.value ?? null,
        linkedAccountId: linked?.id ?? null,
        linkedAccountName: linked?.name ?? null,
      };
    });
  }

  /**
   * Creates a Zoe account mirroring a QuickBooks one and records the mapping
   * between them in the same step, so giving posted against this account never
   * has to ask which QuickBooks account it belongs to.
   */
  async createFromQuickBooks(
    dto: CreateAccountFromQuickBooksDto,
    user: any,
  ): Promise<FinancialAccount> {
    const tenantId = this.tenantContext.requireTenant();

    const qboAccounts = await this.qbService.getQboAccounts(tenantId);
    const qboAccount: QboAccount | undefined = qboAccounts.find(
      (a) => String(a.Id) === String(dto.qboAccountId),
    );
    if (!qboAccount) {
      throw new NotFoundException(
        `QuickBooks account ${dto.qboAccountId} was not found. It may have been deleted or made inactive.`,
      );
    }

    const existing = await this.mappingService.lookupByExternal({
      system: ACCOUNTING_SYSTEM,
      externalReferenceType: 'ACCOUNT',
      externalReferenceId: String(dto.qboAccountId),
    });
    if (existing) {
      throw new BadRequestException(
        `"${qboAccount.Name}" is already linked to an account in Zoe.`,
      );
    }

    const account = new FinancialAccount();
    account.tenant = { id: tenantId } as any;
    account.name = dto.name?.trim() || qboAccount.Name;
    account.accountNumber = dto.accountNumber ?? qboAccount.AcctNum ?? null;
    account.accountType = dto.accountType;
    account.currency =
      dto.currency || qboAccount.CurrencyRef?.value || 'UGX';
    account.description = `Linked to QuickBooks account "${qboAccount.Name}"`;
    account.isActive = true;

    const saved = await this.repository.save(account);

    await this.mappingService.upsert({
      system: ACCOUNTING_SYSTEM,
      internalReferenceType: 'FINANCIAL_ACCOUNT',
      internalReferenceId: String(saved.id),
      externalReferenceType: 'ACCOUNT',
      externalReferenceId: String(qboAccount.Id),
      externalReferenceName: qboAccount.Name,
    });

    this.logger.business('log', 'Financial account created from QuickBooks', {
      operation: 'createAccountFromQuickBooks',
      userId: user?.id,
      metadata: { accountId: saved.id, qboAccountId: qboAccount.Id },
    });

    return saved;
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
