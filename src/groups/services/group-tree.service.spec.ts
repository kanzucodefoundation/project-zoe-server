import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { GroupTreeService } from './group-tree.service';
import { Connection } from 'typeorm';
import Group from '../entities/group.entity';
import GroupCategory from '../entities/groupCategory.entity';

describe('GroupTreeService', () => {
  let service: GroupTreeService;
  let mockGroupRepo: any;
  let mockTreeRepo: any;
  let mockCategoryRepo: any;
  let mockCache: any;

  beforeEach(async () => {
    mockGroupRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    mockTreeRepo = {
      findDescendants: jest.fn().mockResolvedValue([]),
      findAncestors: jest.fn().mockResolvedValue([]),
    };
    mockCategoryRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockConnection = {
      getRepository: jest.fn((entity) => {
        if (entity === GroupCategory) return mockCategoryRepo;
        return mockGroupRepo;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockTreeRepo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupTreeService,
        { provide: 'CONNECTION', useValue: mockConnection },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<GroupTreeService>(GroupTreeService);
  });

  describe('getGroupAndAllChildren', () => {
    it('returns empty array for empty input', async () => {
      const result = await service.getGroupAndAllChildren([]);
      expect(result).toEqual([]);
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('returns cached result when available', async () => {
      mockCache.get.mockResolvedValue([1, 2, 3]);

      const result = await service.getGroupAndAllChildren([1]);

      expect(result).toEqual([1, 2, 3]);
      expect(mockGroupRepo.findOne).not.toHaveBeenCalled();
    });

    it('calculates and caches descendants on cache miss', async () => {
      mockGroupRepo.find.mockImplementation(({ where }: any) => {
        const ids = extractIds(where.parentId);
        if (ids.includes(10)) {
          return Promise.resolve([{ id: 11 }, { id: 12 }]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getGroupAndAllChildren([10]);

      expect(result).toEqual(expect.arrayContaining([10, 11, 12]));
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('gracefully skips groups that do not exist', async () => {
      mockGroupRepo.find.mockResolvedValue([]);

      const result = await service.getGroupAndAllChildren([999]);

      expect(result).toEqual([999]);
    });
    it('does not rely on treeRepository for descendant lookup', async () => {
      mockGroupRepo.find.mockImplementation(({ where }: any) => {
        if (where.parentId === 10) return Promise.resolve([{ id: 11 }]);
        return Promise.resolve([]);
      });

      await service.getGroupAndAllChildren([10]);

      expect(mockTreeRepo.findDescendants).not.toHaveBeenCalled();
    });
  });

  describe('getCategoriesForGroups', () => {
    it('returns empty array for empty input', async () => {
      const result = await service.getCategoriesForGroups([]);
      expect(result).toEqual([]);
    });

    it('returns cached result when available', async () => {
      mockCache.get.mockResolvedValue(['fellowship', 'location']);

      const result = await service.getCategoriesForGroups([1]);

      expect(result).toEqual(['fellowship', 'location']);
      expect(mockGroupRepo.find).not.toHaveBeenCalled();
    });

    it('collects categories from groups and their ancestors', async () => {
      const category1 = { name: 'fellowship' } as GroupCategory;
      const category2 = { name: 'location' } as GroupCategory;
      const group = { id: 1, category: category1 } as Group;
      const ancestorGroup = {
        id: 10,
        category: category2,
      } as Group;

      mockGroupRepo.find.mockResolvedValue([group]);
      mockTreeRepo.findAncestors.mockResolvedValue([{ id: 10 }]);
      mockGroupRepo.findOne.mockResolvedValue(ancestorGroup);

      const result = await service.getCategoriesForGroups([1]);

      expect(result).toEqual(
        expect.arrayContaining(['fellowship', 'location']),
      );
    });

    it('deduplicates categories when multiple groups share the same category', async () => {
      const category = { name: 'fellowship' } as GroupCategory;
      const groups = [
        { id: 1, category },
        { id: 2, category },
      ] as Group[];

      mockGroupRepo.find.mockResolvedValue(groups);
      mockTreeRepo.findAncestors.mockResolvedValue([]);

      const result = await service.getCategoriesForGroups([1, 2]);

      expect(result.filter((c) => c === 'fellowship')).toHaveLength(1);
    });
  });

  describe('clearGroupTreeCache', () => {
    it('deletes cache entries for specified group IDs', async () => {
      await service.clearGroupTreeCache([1, 2]);

      expect(mockCache.del).toHaveBeenCalledTimes(2);
    });

    it('logs a warning when called with no group IDs', async () => {
      await service.clearGroupTreeCache([]);

      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });

  describe('getReportAccessibleGroups', () => {
    it('returns separate canSubmitTo and canViewFrom sets', async () => {
      mockCache.get.mockResolvedValue(null);

      mockGroupRepo.find.mockImplementation(({ where }: any) => {
        const ids = extractIds(where.parentId);
        if (ids.includes(10)) return Promise.resolve([{ id: 11 }]);
        if (ids.includes(20)) return Promise.resolve([{ id: 21 }]);
        return Promise.resolve([]);
      });

      const result = await service.getReportAccessibleGroups([10], [20]);

      expect(result.canSubmitTo).toEqual(expect.arrayContaining([10, 11]));
      expect(result.canViewFrom).toEqual(expect.arrayContaining([20, 21]));
    });
  });
});
// Extracts the array of IDs from a TypeORM In() FindOperator, or wraps a
// scalar value in an array for backward compatibility.
function extractIds(whereParentId: any): number[] {
  if (whereParentId?._value) return whereParentId._value;
  if (whereParentId?.value) return whereParentId.value;
  return [whereParentId];
}
