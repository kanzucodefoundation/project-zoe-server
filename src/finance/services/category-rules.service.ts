import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection, ILike } from 'typeorm';
import CategoryRule from '../entities/category-rule.entity';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateCategoryRuleDto,
  UpdateCategoryRuleDto,
  SearchCategoryRuleDto,
} from '../dto/category-rule.dto';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';

@Injectable()
export class CategoryRulesService {
  private readonly repository: Repository<CategoryRule>;
  private readonly accountRepository: Repository<FinancialAccount>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(CategoryRule);
    this.accountRepository = connection.getRepository(FinancialAccount);
    this.logger = this.appLogger.createContextLogger('CategoryRulesService');
  }

  async create(dto: CreateCategoryRuleDto, user: any): Promise<CategoryRule> {
    const tenantId = this.tenantContext.requireTenant();

    this.logger.business('log', 'Creating category rule', {
      operation: 'createCategoryRule',
      userId: user?.id,
      metadata: { ruleName: dto.name, category: dto.category },
    });

    const rule = new CategoryRule();
    rule.tenant = { id: tenantId } as any;
    rule.name = dto.name;
    rule.category = dto.category;
    rule.conditions = dto.conditions;
    rule.priority = dto.priority || 0;
    rule.isActive = true;
    rule.description = dto.description;

    if (dto.accountId) {
      const account = await this.accountRepository.findOne({
        where: { id: dto.accountId, tenant: { id: tenantId } },
      });
      if (account) {
        rule.account = account;
      }
    }

    return this.repository.save(rule);
  }

  async findAll(dto: SearchCategoryRuleDto): Promise<CategoryRule[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.query) {
      where.name = ILike(`%${dto.query}%`);
    }

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.accountId) {
      where.account = { id: dto.accountId };
    }

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    return this.repository.find({
      where,
      relations: ['account'],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<CategoryRule> {
    const tenantId = this.tenantContext.requireTenant();

    const rule = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['account'],
    });

    if (!rule) {
      throw new NotFoundException(`Category rule with ID ${id} not found`);
    }

    return rule;
  }

  async update(dto: UpdateCategoryRuleDto, user: any): Promise<CategoryRule> {
    const tenantId = this.tenantContext.requireTenant();

    const rule = await this.repository.findOne({
      where: { id: dto.id, tenant: { id: tenantId } },
    });

    if (!rule) {
      throw new NotFoundException(`Category rule with ID ${dto.id} not found`);
    }

    this.logger.business('log', 'Updating category rule', {
      operation: 'updateCategoryRule',
      userId: user?.id,
      resourceId: dto.id,
      resource: 'category_rule',
    });

    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.category !== undefined) rule.category = dto.category;
    if (dto.conditions !== undefined) rule.conditions = dto.conditions;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;
    if (dto.description !== undefined) rule.description = dto.description;

    return this.repository.save(rule);
  }

  async remove(id: number, user: any): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();

    const rule = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
    });

    if (!rule) {
      throw new NotFoundException(`Category rule with ID ${id} not found`);
    }

    this.logger.business('log', 'Deleting category rule', {
      operation: 'deleteCategoryRule',
      userId: user?.id,
      resourceId: id,
      resource: 'category_rule',
    });

    await this.repository.remove(rule);
  }

  async categorizeTransaction(
    transaction: Transaction,
    accountId?: number,
  ): Promise<TransactionCategory | null> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = {
      tenant: { id: tenantId },
      isActive: true,
    };

    if (accountId) {
      where.account = { id: accountId };
    }

    const rules = await this.repository.find({
      where,
      order: { priority: 'DESC' },
    });

    for (const rule of rules) {
      if (this.matchesRule(transaction, rule)) {
        return rule.category;
      }
    }

    return null;
  }

  private matchesRule(transaction: Transaction, rule: CategoryRule): boolean {
    for (const condition of rule.conditions) {
      const fieldValue = this.getFieldValue(transaction, condition.field);

      if (fieldValue === null || fieldValue === undefined) {
        return false;
      }

      const stringValue = String(fieldValue).toLowerCase();
      const conditionValue = condition.value.toLowerCase();

      switch (condition.operator) {
        case 'contains':
          if (!stringValue.includes(conditionValue)) {
            return false;
          }
          break;
        case 'equals':
          if (stringValue !== conditionValue) {
            return false;
          }
          break;
        case 'startsWith':
          if (!stringValue.startsWith(conditionValue)) {
            return false;
          }
          break;
        case 'endsWith':
          if (!stringValue.endsWith(conditionValue)) {
            return false;
          }
          break;
        case 'regex':
          try {
            const regex = new RegExp(condition.value, 'i');
            if (!regex.test(String(fieldValue))) {
              return false;
            }
          } catch {
            return false;
          }
          break;
        default:
          return false;
      }
    }

    return true;
  }

  private getFieldValue(transaction: Transaction, field: string): any {
    switch (field) {
      case 'senderName':
        return transaction.senderName;
      case 'senderPhone':
        return transaction.senderPhone;
      case 'narration':
        return transaction.narration;
      case 'externalReference':
        return transaction.externalReference;
      case 'amount':
        return transaction.amount;
      default:
        return null;
    }
  }
}
