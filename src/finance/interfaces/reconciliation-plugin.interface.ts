import { TransactionCategory } from '../enums/transaction-category.enum';
import ReconciliationMatch from '../entities/reconciliation-match.entity';
import Contact from '../../crm/entities/contact.entity';
import Transaction from '../entities/transaction.entity';

export interface DistributionRule {
  targetType: 'group' | 'account';
  targetId: number;
  percentage: number;
  description: string;
}

export interface MatchResult {
  contact: Contact;
  confidenceScore: number;
  matchCriteria: {
    method: string;
    matchedValue?: string;
    similarity?: number;
  };
}

export interface IReconciliationPlugin {
  /**
   * Unique identifier for the plugin
   */
  pluginId: string;

  /**
   * Human-readable name for the plugin
   */
  pluginName: string;

  /**
   * Calculate how the matched amount should be distributed
   * based on the transaction category and configured rules
   *
   * @param match - The reconciliation match
   * @param category - The transaction category
   * @param amount - The transaction amount
   * @returns Array of distribution rules
   */
  calculateDistributions(
    match: ReconciliationMatch,
    category: TransactionCategory,
    amount: number,
  ): Promise<DistributionRule[]>;

  /**
   * Optional custom matching logic for specific use cases
   *
   * @param transaction - The transaction to match
   * @param contacts - Available contacts to match against
   * @returns Match result or null if no match found
   */
  customMatchLogic?(
    transaction: Transaction,
    contacts: Contact[],
  ): Promise<MatchResult | null>;
}
