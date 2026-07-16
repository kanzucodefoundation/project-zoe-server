import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Connection, In, Repository, TreeRepository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupCategory from '../entities/groupCategory.entity';

@Injectable()
export class GroupTreeService {
  private readonly logger = new Logger(GroupTreeService.name);
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly categoryRepository: Repository<GroupCategory>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.repository = connection.getRepository(Group);
    this.treeRepository = connection.getTreeRepository(Group);
    this.categoryRepository = connection.getRepository(GroupCategory);
  }

  // Add these two private helpers, reused by both getGroupAndAllChildren and invalidateGroupCache

  /**
   * BFS walk down parentId, batched by tree level via In(). Does not depend
   * on the closure table, which can silently drift from parentId.
   */
  private async findDescendantIds(rootIds: number[]): Promise<Set<number>> {
    const visited = new Set<number>(rootIds);
    let currentLevelIds = [...rootIds];

    while (currentLevelIds.length > 0) {
      const children = await this.repository.find({
        where: { parentId: In(currentLevelIds) },
        select: ['id'],
      });

      const nextLevelIds: number[] = [];
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          nextLevelIds.push(child.id);
        }
      }
      currentLevelIds = nextLevelIds;
    }

    return visited;
  }

  /**
   * Walks up parentId from a single group to the root. Manual walk (not
   * closure-table-based) for the same drift-safety reason as findDescendantIds.
   */
  private async findAncestorIds(groupId: number): Promise<number[]> {
    const ancestorIds: number[] = [];
    const visited = new Set<number>();

    const startGroup = await this.repository.findOne({
      where: { id: groupId },
      select: ['id', 'parentId'],
    });
    let currentParentId = startGroup?.parentId ? Number(startGroup.parentId) : null;

    while (currentParentId !== null && !isNaN(currentParentId)) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      ancestorIds.push(currentParentId);

      const parentNode = await this.repository.findOne({
        where: { id: currentParentId },
        select: ['id', 'parentId'],
      });
      currentParentId = parentNode?.parentId ? Number(parentNode.parentId) : null;
    }

    return ancestorIds;
  }
  /**
   * Get a group and all its descendant groups (children, grandchildren, etc.)
   * Results are cached for performance
   */
  async getGroupAndAllChildren(groupIds: number[]): Promise<number[]> {
    if (groupIds.length === 0) return [];

    const cacheKey = `group-tree:${groupIds.sort().join(',')}`;
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for group tree: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for group tree: ${cacheKey}`);

    const result = Array.from(await this.findDescendantIds(groupIds));

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
        const ancestors = await this.treeRepository.findAncestors(group);

        for (const ancestor of ancestors) {
          const ancestorWithCategory = await this.repository.findOne({
            where: { id: ancestor.id },
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
      const ancestors = await this.treeRepository.findAncestors(group);

      for (const ancestor of ancestors) {
        const ancestorWithCategory = await this.repository.findOne({
          where: { id: ancestor.id },
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

  /**
   * Invalidate cache when group structure changes
   * This should be called when groups are created, updated, or deleted
   */
  async invalidateGroupCache(groupId: number): Promise<void> {
    const group = await this.repository.findOne({ where: { id: groupId } });
    if (!group) return;

    const [ancestorIds, descendantIds] = await Promise.all([
      this.findAncestorIds(groupId),
      this.findDescendantIds([groupId]),
    ]);

    const affectedGroups = [
      groupId,
      ...ancestorIds,
      ...Array.from(descendantIds).filter((id) => id !== groupId),
    ];

    await this.clearGroupTreeCache(affectedGroups);

    this.logger.debug(
      `Invalidated cache for group ${groupId} and ${affectedGroups.length} related groups`,
    );
  }
}
