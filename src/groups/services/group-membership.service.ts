import { Injectable, Logger, Inject } from "@nestjs/common";
import { Connection, In, Repository, TreeRepository } from "typeorm";
import GroupMembership from "../entities/groupMembership.entity";
import GroupMembershipDto from "../dto/membership/group-membership.dto";
import { getPersonFullName } from "../../crm/crm.helpers";
import GroupMembershipSearchDto from "../dto/membership/group-membership-search.dto";
import ClientFriendlyException from "../../shared/exceptions/client-friendly.exception";
import UpdateGroupMembershipDto from "../dto/membership/update-group-membership.dto";
import BatchGroupMembershipDto from "../dto/membership/batch-group-membership.dto";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { hasNoValue, hasValue } from "../../utils/validation";
import Group from "../entities/group.entity";

@Injectable()
export class GroupsMembershipService {
  private readonly repository: Repository<GroupMembership>;
  private readonly groupTreeRepository: TreeRepository<Group>;
  private readonly connection: Connection;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(GroupMembership);
    this.groupTreeRepository = connection.getTreeRepository(Group);
    this.connection = connection;
  }

  async findAll(req: GroupMembershipSearchDto): Promise<GroupMembershipDto[]> {
    const filter: Record<string, any> = {};

    if (hasValue(req.contactId)) {
      filter.contactId = req.contactId;
    }

    if (hasValue(req.groupId)) {
      const parentGroup = await this.groupTreeRepository.findOneOrFail({
        where: { id: req.groupId },
      });
      const childGroupIds =
        await this.groupTreeRepository.findDescendants(parentGroup);
      const idList = new Set([
        req.groupId,
        ...childGroupIds.map((it) => it.id),
      ]);
      filter.groupId = In([...idList.values()]);
    }

    if (hasNoValue(filter)) {
      throw new ClientFriendlyException("Please specify groupId or contactId");
    }

    const data = await this.repository.find({
      relations: ["contact", "contact.person", "group", "group.category"],
      skip: req.skip,
      take: req.limit,
      where: filter,
    });
    return data.map((it) => this.toDto(it, req.groupId));
  }

  toDto(membership: GroupMembership, refGroupId: number): GroupMembershipDto {
    const { group, contact, ...rest } = membership;
    return {
      ...rest,
      isInferred: refGroupId !== refGroupId,
      group: group ? { name: group.name, id: group.id } : null,
      category: group.category
        ? { name: group.category.name, id: group.category.id }
        : null,
      contact: { name: getPersonFullName(contact.person), id: contact.id },
    };
  }

  async create(data: BatchGroupMembershipDto): Promise<number> {
    const { groupId, members, role } = data;
    const toInsert: QueryDeepPartialEntity<GroupMembership>[] = [];
    members.forEach((contactId) => {
      toInsert.push({ groupId, contactId, role });
    });
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(GroupMembership)
      .values(toInsert)
      .execute();
    return members.length;
  }

  async findOne(id: number): Promise<GroupMembershipDto> {
    const data = await this.repository.findOne({
      where: { id },
      relations: ["group", "contact", "contact.person"],
    });
    return this.toDto(data, 0);
  }

  async update(dto: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    const update = await this.connection
      .createQueryBuilder()
      .update(GroupMembership)
      .set({
        role: dto.role,
      })
      .where("id = :id", { id: dto.id })
      .execute();
    Logger.log(`Updated data ${update.affected} ${JSON.stringify(update.raw)}`);
    return await this.findOne(dto.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
