import { Inject, Injectable } from '@nestjs/common';
import { Connection, In, Repository, TreeRepository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import { roleAdmin } from '../../auth/constants';

@Injectable()
export class GroupPermissionsService {
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(Group);
    this.treeRepository = connection.getTreeRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  private isAdmin(user: any): boolean {
    return Array.isArray(user?.roles) && user.roles.includes(roleAdmin.role);
  }

  async hasPermissionForGroup(user: any, groupId: number) {
    if (this.isAdmin(user)) {
      return true;
    }

    // Check if user is a leader of the specific group
    const directLeadership = await this.membershipRepository.count({
      where: {
        contactId: user.contactId,
        role: GroupRole.Leader,
        groupId: groupId,
      },
    });

    if (directLeadership >= 1) {
      return true;
    }

    // Check if user is a leader of any parent group (hierarchical permissions)
    const targetGroup = await this.repository.findOne({
      where: { id: groupId },
    });
    if (!targetGroup) {
      return false;
    }

    // Replacing crashing TypeORM 0.3.29 findAncestors tree method
    const ancestorIds: number[] = [];
    let currentParentId = targetGroup.parentId ? Number(targetGroup.parentId) : null;
    const visitedParentIds = new Set<number>();
    while (currentParentId !== null && !isNaN(currentParentId)) {
      if (visitedParentIds.has(currentParentId)) {
        break;
      }
      visitedParentIds.add(currentParentId);
      ancestorIds.push(currentParentId);
      const parentNode = await this.repository.findOne({
        where: { id: currentParentId },
        select: ['id', 'parentId'],
      });
      currentParentId = parentNode?.parentId ? Number(parentNode.parentId) : null;
    }    if (ancestorIds.length > 0) {
      const parentLeadership = await this.membershipRepository.count({
        where: {
          contactId: user.contactId,
          role: GroupRole.Leader,
          groupId: In(ancestorIds),
        },
      });
      return parentLeadership >= 1;
    }

    return false;
  }

  // Is leader of group or one of the ancestors
  async assertPermissionForGroup(user: any, groupId: number) {
    const hasPerms = await this.hasPermissionForGroup(user, groupId);
    if (!hasPerms) {
      throw new ClientFriendlyException(
        'You have no permissions to modify this group',
      );
    }
  }

  // Bulk equivalent of hasPermissionForGroup: the set of group IDs for which
  // hasPermissionForGroup(user, id) would return true. Returns null when the
  // user is an admin, signalling "all groups accessible" without materialising
  // the full ID list.
  async getAccessibleGroupIds(user: any): Promise<number[] | null> {
    if (this.isAdmin(user)) {
      return null;
    }
    if (!user?.contactId) {
      return [];
    }
    return this.getUserGroupIds(user);
  }

  async getUserGroupIds(user: any) {
    const membershipData = await this.membershipRepository.find({
      select: ['groupId'],
      where: {
        contactId: user.contactId,
        role: GroupRole.Leader,
      },
    });
    const membershipIds = membershipData
      .map((it) => Number(it.groupId))
      .filter((id) => !isNaN(id));
    const descendantIds = await this.getGroupAndAllDescendants(membershipIds);
    const idList = new Set([...membershipIds, ...descendantIds]);
    return Array.from(idList);
  }

  async getUserIsMemberLeaderGroupIds(user: any) {
    const membershipData = await this.membershipRepository.find({
      select: ['groupId'],
      where: {
        contactId: user.contactId,
        role: In([GroupRole.Member, GroupRole.Leader]),
      },
    });
    const membershipIds = membershipData
      .map((it) => Number(it.groupId))
      .filter((id) => !isNaN(id));
    const descendantIds = await this.getGroupAndAllDescendants(membershipIds);
    const idList = new Set([...membershipIds, ...descendantIds]);
    return Array.from(idList);
  }

  private async getGroupAndAllDescendants(
    rootGroupIds: number[],
  ): Promise<number[]> {
    const visited = new Set<number>();
    const queue: number[] = [];
    const descendantIds: number[] = [];

    for (const groupId of rootGroupIds) {
      if (!visited.has(groupId)) {
        visited.add(groupId);
        queue.push(groupId);
      }
    }

    while (queue.length > 0) {
      const currentGroupId = queue.shift();
      if (currentGroupId === undefined) {
        continue;
      }

      const children = await this.repository.find({
        where: { parentId: currentGroupId },
        select: ['id'],
      });

      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          descendantIds.push(child.id);
          queue.push(child.id);
        }
      }
    }

    return descendantIds;
  }
}
