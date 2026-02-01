import { Injectable } from '@nestjs/common';
import {
  IReconciliationPlugin,
  DistributionRule,
} from '../interfaces/reconciliation-plugin.interface';
import { TransactionCategory } from '../enums/transaction-category.enum';
import ReconciliationMatch from '../entities/reconciliation-match.entity';

/**
 * Default reconciliation plugin that distributes 100% to the general fund
 */
@Injectable()
export class DefaultReconciliationPlugin implements IReconciliationPlugin {
  pluginId = 'default';
  pluginName = 'Default Distribution';

  async calculateDistributions(
    match: ReconciliationMatch,
    category: TransactionCategory,
    amount: number,
  ): Promise<DistributionRule[]> {
    // Default behavior: 100% goes to general fund (represented by the match's group)
    return [
      {
        targetType: 'group',
        targetId: match.group?.id || 0,
        percentage: 100,
        description: `${category || 'General'} - Full amount to general fund`,
      },
    ];
  }
}
