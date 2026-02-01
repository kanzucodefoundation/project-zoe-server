import { Injectable } from '@nestjs/common';
import {
  IReconciliationPlugin,
  DistributionRule,
} from '../interfaces/reconciliation-plugin.interface';
import { TransactionCategory } from '../enums/transaction-category.enum';
import ReconciliationMatch from '../entities/reconciliation-match.entity';

/**
 * Worship Harvest specific reconciliation plugin
 * Implements custom distribution rules for tithes, offerings, etc.
 *
 * Tithe Distribution:
 * - 10% to Ministries
 * - 30% to Operations
 * - 60% to Locations
 */
@Injectable()
export class WorshipHarvestReconciliationPlugin
  implements IReconciliationPlugin
{
  pluginId = 'worship-harvest';
  pluginName = 'Worship Harvest Distribution';

  // These would typically be configured per-tenant or loaded from database
  // For now, using placeholder IDs that should be configured during setup
  private readonly MINISTRIES_GROUP_ID = 1; // Placeholder - configure in setup
  private readonly OPERATIONS_GROUP_ID = 2; // Placeholder - configure in setup

  async calculateDistributions(
    match: ReconciliationMatch,
    category: TransactionCategory,
    amount: number,
  ): Promise<DistributionRule[]> {
    const locationGroupId = match.group?.id || 0;

    switch (category) {
      case TransactionCategory.TITHE:
        return this.calculateTitheDistribution(locationGroupId);

      case TransactionCategory.OFFERING:
        return this.calculateOfferingDistribution(locationGroupId);

      case TransactionCategory.DONATION:
        return this.calculateDonationDistribution(locationGroupId);

      case TransactionCategory.ARISE_BUILD:
        return this.calculateAriseBuildDistribution(locationGroupId);

      default:
        // Default: 100% to the location
        return [
          {
            targetType: 'group',
            targetId: locationGroupId,
            percentage: 100,
            description: 'Unspecified - Full amount to location',
          },
        ];
    }
  }

  private calculateTitheDistribution(locationGroupId: number): DistributionRule[] {
    return [
      {
        targetType: 'group',
        targetId: this.MINISTRIES_GROUP_ID,
        percentage: 10,
        description: 'Tithe - Ministries allocation (10%)',
      },
      {
        targetType: 'group',
        targetId: this.OPERATIONS_GROUP_ID,
        percentage: 30,
        description: 'Tithe - Operations allocation (30%)',
      },
      {
        targetType: 'group',
        targetId: locationGroupId,
        percentage: 60,
        description: 'Tithe - Location allocation (60%)',
      },
    ];
  }

  private calculateOfferingDistribution(
    locationGroupId: number,
  ): DistributionRule[] {
    // Offerings typically go 100% to the location
    return [
      {
        targetType: 'group',
        targetId: locationGroupId,
        percentage: 100,
        description: 'Offering - Full amount to location',
      },
    ];
  }

  private calculateDonationDistribution(
    locationGroupId: number,
  ): DistributionRule[] {
    // Donations typically go 100% to the designated cause/location
    return [
      {
        targetType: 'group',
        targetId: locationGroupId,
        percentage: 100,
        description: 'Donation - Full amount to designated group',
      },
    ];
  }

  private calculateAriseBuildDistribution(
    locationGroupId: number,
  ): DistributionRule[] {
    // Arise & Build contributions go to a central building fund
    // Could be configured to a specific account/group
    return [
      {
        targetType: 'group',
        targetId: locationGroupId,
        percentage: 100,
        description: 'Arise & Build - Full amount to building fund',
      },
    ];
  }
}
