import { Inject, Injectable } from "@nestjs/common";
import { Connection, In, Repository, TreeRepository } from "typeorm";
import Group from "../entities/group.entity";
import GroupMembership from "../entities/groupMembership.entity";
import { GroupRole } from "../enums/groupRole";
import ClientFriendlyException from "../../shared/exceptions/client-friendly.exception";

@Injectable()
export class GroupPermissionsService {
  private readonly repository: Repository<Group>;
  private readonly treeRepository: TreeRepository<Group>;
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(Group);
    this.treeRepository = connection.getTreeRepository(Group);
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  async hasPermissionForGroup(user: any, groupId: number) {
    const ancestors = await this.treeRepository.findAncestors({
      id: groupId,
    } as Group);
    const ancestorsIds = [groupId, ...ancestors.map((it) => it.id)];
    const result = await this.membershipRepository.count({
      where: {
        contactId: user.contactId,
        role: GroupRole.Leader,
        groupId: In(ancestorsIds),
      },
    });
    return result >= 1;
  }

  // Is leader of group or one of the ancestors
  async assertPermissionForGroup(user: any, groupId: number) {
    const hasPerms = await this.hasPermissionForGroup(user, groupId);
    if (!hasPerms) {
      throw new ClientFriendlyException(
        `You have no permissions to modify this group`,
      );
    }
  }

  async getUserGroupIds(user: any) {
    const membershipData = await this.membershipRepository.find({
      select: ["groupId"],
      where: {
        contactId: user.contactId,
        role: GroupRole.Leader,
      },
    });
    const descendants = [];
    for (const mData of membershipData) {
      const res = await this.treeRepository.findDescendants({
        id: mData.groupId,
      } as Group);
      descendants.push(...res);
    }
    const idList = new Set([
      ...membershipData.map((it) => it.groupId),
      ...descendants.map((it) => it.id),
    ]);
    return Array.from(idList);
  }
}
