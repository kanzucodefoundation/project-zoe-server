import { Inject, Injectable } from '@nestjs/common';
import { Connection, In, Repository } from 'typeorm';
import Group from '../entities/group.entity';
import GroupMembership from '../entities/groupMembership.entity';
import { GroupRole } from '../enums/groupRole';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import { roleAdmin } from '../../auth/constants';

@Injectable()
export class GroupPermissionsService {
  private readonly repository: Repository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  async hasPermissionForGroup(user: any, groupId: number) {
    if (Array.isArray(user?.roles) && user.roles.includes(roleAdmin.role)) {
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

    const ancestorIds = await this.getAncestorIds(targetGroup.id);

    if (ancestorIds.length > 0) {
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

  async getUserGroupIds(user: any) {
    const membershipData = await this.membershipRepository.find({
      select: ['groupId'],
      where: {
        contactId: user.contactId,
        role: GroupRole.Leader,
      },
    });
    const descendants = [];
    for (const mData of membershipData) {
      const res = await this.getDescendantIds(mData.groupId);
      descendants.push(...res.map((id) => ({ id })));
    }
    const idList = new Set([
      ...membershipData.map((it) => it.groupId),
      ...descendants.map((it) => it.id),
    ]);
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
    const descendants = [];
    for (const mData of membershipData) {
      const res = await this.getDescendantIds(mData.groupId);
      descendants.push(...res.map((id) => ({ id })));
    }
    const idList = new Set([
      ...membershipData.map((it) => it.groupId),
      ...descendants.map((it) => it.id),
    ]);
    return Array.from(idList);
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
}
