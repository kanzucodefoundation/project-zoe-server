import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Connection, In, Repository, TreeRepository } from "typeorm";
import { FindConditions } from "typeorm/find-options/FindConditions";
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
import { groupConstants } from "../../seed/data/groups";

@Injectable()
export class GroupsMembershipService {
  constructor(
    @InjectRepository(GroupMembership)
    private readonly repository: Repository<GroupMembership>,
    @InjectRepository(Group)
    private readonly groupTreeRepository: TreeRepository<Group>,
    private connection: Connection,
  ) {}

  async findAll(req: GroupMembershipSearchDto): Promise<GroupMembershipDto[]> {
    const filter: FindConditions<GroupMembership> = {};
    if (hasValue(req.contactId)) {
      filter.contactId = req.contactId;
    }
    if (hasValue(req.groupId)) {
      const parentGroup = await this.groupTreeRepository.findOneOrFail(
        req.groupId,
      );
      const childGroupIds = await this.groupTreeRepository.findDescendants(
        parentGroup,
      );
      const idList = new Set([
        req.groupId,
        ...childGroupIds.map((it) => it.id),
      ]);
      filter.groupId = In([...idList.values()]);
    }
    if (hasNoValue(filter))
      throw new ClientFriendlyException("Please groupID or contactId");
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
    const data = await this.repository.findOne(id, {
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
