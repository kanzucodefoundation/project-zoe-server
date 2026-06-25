import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Connection, In, Repository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupCategory from '../entities/groupCategory.entity';

@Injectable()
export class GroupTreeService {
  private readonly logger = new Logger(GroupTreeService.name);
  private readonly repository: Repository<Group>;
  private readonly categoryRepository: Repository<GroupCategory>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.repository = connection.getRepository(Group);
    this.categoryRepository = connection.getRepository(GroupCategory);
  }

  /**
   * Get a group and all its descendant groups (children, grandchildren, etc.)
   * Results are cached for performance
   */
  async getGroupAndAllChildren(groupIds: number[]): Promise<number[]> {
    if (groupIds.length === 0) return [];

    const cacheKey = `group-tree:${groupIds.sort().join(',')}`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for group tree: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for group tree: ${cacheKey}`);

    // Calculate descendants
    const allGroupIds = new Set(groupIds);

    for (const groupId of groupIds) {
      try {
        const group = await this.repository.findOne({ where: { id: groupId } });
        if (!group) continue;

        const descendants = await this.getDescendantIds(groupId);
        descendants.forEach((descendantId) => allGroupIds.add(descendantId));
      } catch (error) {
        this.logger.error(
          `Error finding descendants for group ${groupId}:`,
          error,
        );
      }
    }

    const result = Array.from(allGroupIds);

    // Cache for 30 minutes
    await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);

    return result;
  }

  /**
   * Get categories for the given groups, including parent categories
   * For example, if groups are fellowships under zones, return ['fellowship', 'zone', 'location']
   */
  async getCategoriesForGroups(groupIds: number[]): Promise<string[]> {
    if (groupIds.length === 0) return [];

    const cacheKey = `group-categories:${groupIds.sort().join(',')}`;

    const cached = await this.cacheManager.get<string[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for group categories: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for group categories: ${cacheKey}`);

    const categories = new Set<string>();

    // Get groups with their categories and ancestors
    const groups = await this.repository.find({
      where: { id: In(groupIds) },
      relations: ['category'],
    });

    for (const group of groups) {
      if (!group.category) continue;

      // Add current group's category
      categories.add(group.category.name);

      // Get all ancestor groups to find their categories too
      try {
        const ancestorIds = await this.getAncestorIds(group.id);

        for (const ancestorId of ancestorIds) {
          const ancestorWithCategory = await this.repository.findOne({
            where: { id: ancestorId },
            relations: ['category'],
          });

          if (ancestorWithCategory?.category) {
            categories.add(ancestorWithCategory.category.name);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error finding ancestors for group ${group.id}:`,
          error,
        );
      }
    }

    const result = Array.from(categories);

    // Cache for 30 minutes
    await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);

    return result;
  }

  /**
   * Get all groups that belong to the specified categories or their child categories
   * For example, if user can manage 'location' category, return all location/zone/fellowship groups
   */
  async getGroupsByCategories(
    categories: string[],
    userGroupIds: number[],
  ): Promise<number[]> {
    if (categories.length === 0) return [];

    const cacheKey = `groups-by-categories:${categories
      .sort()
      .join(',')}:${userGroupIds.sort().join(',')}`;

    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for groups by categories: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for groups by categories: ${cacheKey}`);

    const resultGroupIds = new Set<number>();

    // Start with user's manageable groups
    const expandedUserGroups = await this.getGroupAndAllChildren(userGroupIds);

    // Filter by category hierarchy
    for (const groupId of expandedUserGroups) {
      try {
        const group = await this.repository.findOne({
          where: { id: groupId },
          relations: ['category'],
        });

        if (!group?.category) continue;

        // Check if this group's category matches or is a child of allowed categories
        const groupCategoryMatches = await this.isCategoryAllowed(
          group.category.name,
          categories,
          group,
        );

        if (groupCategoryMatches) {
          resultGroupIds.add(groupId);
        }
      } catch (error) {
        this.logger.error(
          `Error checking category for group ${groupId}:`,
          error,
        );
      }
    }

    const result = Array.from(resultGroupIds);

    // Cache for 30 minutes
    await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);

    return result;
  }

  /**
   * Check if a group's category is allowed based on category hierarchy
   * For example, if 'location' is allowed, then 'zone' and 'fellowship' are also allowed
   * if they are children of location groups
   */
  private async isCategoryAllowed(
    groupCategory: string,
    allowedCategories: string[],
    group: Group,
  ): Promise<boolean> {
    // Direct match
    if (allowedCategories.includes(groupCategory)) {
      return true;
    }

    // Check if group is a descendant of a group with an allowed category
    try {
      const ancestorIds = await this.getAncestorIds(group.id);

      for (const ancestorId of ancestorIds) {
        const ancestorWithCategory = await this.repository.findOne({
          where: { id: ancestorId },
          relations: ['category'],
        });

        if (
          ancestorWithCategory?.category &&
          allowedCategories.includes(ancestorWithCategory.category.name)
        ) {
          return true;
        }
      }
    } catch (error) {
      this.logger.error(
        `Error checking category hierarchy for group ${group.id}:`,
        error,
      );
    }

    return false;
  }

  /**
   * Get all groups that a user can access for reports
   * This includes their manageable groups and all descendants, filtered by category hierarchy
   */
  async getReportAccessibleGroups(
    userManageableGroups: number[],
    userViewableGroups: number[],
  ): Promise<{ canSubmitTo: number[]; canViewFrom: number[] }> {
    const [canSubmitTo, canViewFrom] = await Promise.all([
      this.getGroupAndAllChildren(userManageableGroups),
      this.getGroupAndAllChildren(userViewableGroups),
    ]);

    return { canSubmitTo, canViewFrom };
  }

  /**
   * Clear cache for specific group tree operations
   */
  async clearGroupTreeCache(groupIds: number[] = []): Promise<void> {
    if (groupIds.length === 0) {
      // Clear all cache entries that start with our prefixes
      // Note: This requires a more sophisticated cache implementation
      // For now, we'll just log that cache should be cleared
      this.logger.warn('Cache clear requested for all group tree data');
      return;
    }

    const cacheKeys = [
      `group-tree:${groupIds.sort().join(',')}`,
      `group-categories:${groupIds.sort().join(',')}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.debug(`Cleared cache for keys: ${cacheKeys.join(', ')}`);
  }

  private getClosureQueryParams() {
    const metadata = this.repository.metadata;
    const closureMetadata = metadata.closureJunctionTable;
    const groupTable = metadata.schema
      ? `"${metadata.schema}"."${metadata.tableName}"`
      : `"${metadata.tableName}"`;
    const closureTable = closureMetadata.schema
      ? `"${closureMetadata.schema}"."${closureMetadata.tableName}"`
      : `"${closureMetadata.tableName}"`;
    const ancestorColumn = closureMetadata.ancestorColumns[0].databaseName;
    const descendantColumn = closureMetadata.descendantColumns[0].databaseName;
    return { groupTable, closureTable, ancestorColumn, descendantColumn };
  }

  private async getAncestorIds(groupId: number): Promise<number[]> {
    const { groupTable, closureTable, ancestorColumn, descendantColumn } =
      this.getClosureQueryParams();

    const rows: Array<{ id: number }> = await this.repository.query(
      `SELECT g.id FROM ${groupTable} g
       JOIN ${closureTable} c ON c."${ancestorColumn}" = g.id
       WHERE c."${descendantColumn}" = $1
         AND g.id != $1`,
      [groupId],
    );
    return rows.map((row) => row.id);
  }

  private async getDescendantIds(groupId: number): Promise<number[]> {
    const { groupTable, closureTable, ancestorColumn, descendantColumn } =
      this.getClosureQueryParams();

    const rows: Array<{ id: number }> = await this.repository.query(
      `SELECT g.id FROM ${groupTable} g
       JOIN ${closureTable} c ON c."${descendantColumn}" = g.id
       WHERE c."${ancestorColumn}" = $1
         AND g.id != $1`,
      [groupId],
    );
    return rows.map((row) => row.id);
  }

  /**
   * Invalidate cache when group structure changes
   * This should be called when groups are created, updated, or deleted
   */
  async invalidateGroupCache(groupId: number): Promise<void> {
    // Find all groups that might be affected by this change
    const group = await this.repository.findOne({ where: { id: groupId } });
    if (!group) return;

    // Get ancestors and descendants that might be cached
    const [ancestors, descendants] = await Promise.all([
      this.getAncestorIds(groupId),
      this.getDescendantIds(groupId),
    ]);

    const affectedGroups = [groupId, ...ancestors, ...descendants];

    // Clear relevant cache entries
    await this.clearGroupTreeCache(affectedGroups);

    this.logger.debug(
      `Invalidated cache for group ${groupId} and ${affectedGroups.length} related groups`,
    );
  }
}
