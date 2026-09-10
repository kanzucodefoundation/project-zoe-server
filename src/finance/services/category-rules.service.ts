import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository, Connection, ILike, IsNull } from 'typeorm';
import CategoryRule from '../entities/category-rule.entity';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateCategoryRuleDto,
  UpdateCategoryRuleDto,
  SearchCategoryRuleDto,
} from '../dto/category-rule.dto';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { getZonedParts } from '../finance-time';
import {
  CategoryRuleConditions,
  LegacyRuleCondition,
} from '../dto/category-rule-conditions';
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

  /**
   * The category for a transaction, or null when no rule matches.
   * Prefer `matchTransaction` when the caller also wants to say *why*.
   */
  async categorizeTransaction(
    transaction: Transaction,
    accountId?: number,
  ): Promise<TransactionCategory | null> {
    const match = await this.matchTransaction(transaction, accountId);
    return match ? match.category : null;
  }

  /**
   * The first rule that matches, in priority order, with the rule's name so
   * the import preview can show the justification for each categorisation
   * rather than an unexplained category.
   */
  async matchTransaction(
    transaction: Transaction,
    accountId?: number,
  ): Promise<{ category: TransactionCategory; rule: string } | null> {
    const tenantId = this.tenantContext.requireTenant();

    const base = {
      tenant: { id: tenantId },
      isActive: true,
    };

    // A rule can be scoped to an account two ways: the entity's `account`
    // relation, or `conditions.accounts` from the rule builder — which leaves
    // the relation null. Filtering on the relation alone therefore hid every
    // builder-written rule from the import that needed it, so tenant-wide
    // rules are included here and `conditions.accounts` is enforced during
    // matching instead.
    const where: any = accountId
      ? [
          { ...base, account: { id: accountId } },
          { ...base, account: IsNull() },
        ]
      : base;

    const rules = await this.repository.find({
      where,
      relations: { account: true },
      order: { priority: 'DESC' },
    });

    for (const rule of rules) {
      if (this.matchesRule(transaction, rule, accountId)) {
        return { category: rule.category, rule: rule.name };
      }
    }

    return null;
  }

  private matchesRule(
    transaction: Transaction,
    rule: CategoryRule,
    accountId?: number,
  ): boolean {
    if (!rule.conditions) {
      return false;
    }

    return Array.isArray(rule.conditions)
      ? this.matchesLegacyConditions(transaction, rule.conditions)
      : this.matchesBuilderConditions(transaction, rule.conditions, accountId);
  }

  /**
   * Minutes since midnight for 'HH:mm'.
   */
  private static toMinutes(time: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? '').trim());
    if (!match) {
      return null;
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  /**
   * Evaluates the rule-builder conditions. Everything the author specified
   * must hold; anything they left out is simply not checked.
   *
   * Day and time are read in the finance timezone (Kampala by default), not
   * the server's — a UTC host would otherwise see the 09:00 service at 09:00Z
   * and skip an 08:00-12:00 rule. See finance-time.ts.
   */
  private matchesBuilderConditions(
    transaction: Transaction,
    conditions: CategoryRuleConditions,
    accountId?: number,
  ): boolean {
    const {
      accounts,
      keywords,
      daysOfWeek,
      timeRange,
      dateRange,
      applyEveryYear,
    } = conditions;

    // Guard against a rule saved before validation existed: with nothing to
    // match on it would otherwise swallow every transaction.
    if (
      !accounts?.length &&
      !keywords?.length &&
      !daysOfWeek?.length &&
      !timeRange &&
      !dateRange
    ) {
      return false;
    }

    if (accounts?.length) {
      const transactionAccountId = transaction.account?.id ?? accountId;
      if (!transactionAccountId || !accounts.includes(transactionAccountId)) {
        return false;
      }
    }

    if (keywords?.length) {
      const haystack = [
        transaction.narration,
        transaction.senderName,
        transaction.externalReference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // Any keyword is enough — they read as alternatives, not requirements.
      const hit = keywords.some((word) =>
        haystack.includes(word.trim().toLowerCase()),
      );
      if (!hit) {
        return false;
      }
    }

    const date = transaction.transactionDate
      ? new Date(transaction.transactionDate)
      : null;
    const hasDate = !!date && !isNaN(date.getTime());
    const needsDate = !!daysOfWeek?.length || !!timeRange || !!dateRange;

    if (needsDate && !hasDate) {
      return false;
    }

    const when = hasDate ? getZonedParts(date) : null;

    if (daysOfWeek?.length && !daysOfWeek.includes(when.dayOfWeek)) {
      return false;
    }

    if (timeRange) {
      const start = CategoryRulesService.toMinutes(timeRange.start);
      const end = CategoryRulesService.toMinutes(timeRange.end);
      // A rule with an unreadable window must not match anything.
      if (start === null || end === null) {
        return false;
      }
      if (when.minutes < start || when.minutes > end) {
        return false;
      }
    }

    if (dateRange) {
      if (applyEveryYear) {
        // Recurring window: compare month/day only, and allow a range that
        // wraps the new year (e.g. 12-20 to 01-05).
        const start = dateRange.start.slice(5);
        const end = dateRange.end.slice(5);

        const inRange =
          start <= end
            ? when.monthDay >= start && when.monthDay <= end
            : when.monthDay >= start || when.monthDay <= end;

        if (!inRange) {
          return false;
        }
      } else if (when.date < dateRange.start || when.date > dateRange.end) {
        return false;
      }
    }

    return true;
  }

  private matchesLegacyConditions(
    transaction: Transaction,
    conditions: LegacyRuleCondition[],
  ): boolean {
    if (conditions.length === 0) {
      return false;
    }

    for (const condition of conditions) {
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
