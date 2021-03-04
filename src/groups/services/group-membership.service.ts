import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { hasNoValue, hasValue } from '../../utils/basicHelpers';
import GroupMembership from '../entities/groupMembership.entity';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { getPersonFullName } from '../../crm/crm.helpers';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import BatchGroupMembershipDto from '../dto/membership/batch-group-membership.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class GroupsMembershipService {
  constructor(
    @InjectRepository(GroupMembership)
    private readonly repository: Repository<GroupMembership>,
    private connection: Connection,
  ) {}

  async findAll(req: GroupMembershipSearchDto): Promise<GroupMembershipDto[]> {
    const filter: FindConditions<GroupMembership> = {};
    if (hasValue(req.contactId)) {
      filter.contactId = req.contactId;
    }
    if (hasValue(req.groupId)) {
      filter.groupId = req.groupId;
    }
    if (hasNoValue(filter))
      throw new ClientFriendlyException('Please groupID or contactId');
    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'group'],
      skip: req.skip,
      take: req.limit,
      where: filter,
    });
    return data.map(this.toDto);
  }

  toDto(membership: GroupMembership): GroupMembershipDto {
    const { group, contact, ...rest } = membership;
    return {
      ...rest,
      group: group ? { name: group.name, id: group.id } : null,
      contact: { name: getPersonFullName(contact.person), id: contact.id },
    };
  }

  async create(data: BatchGroupMembershipDto): Promise<number> {
    const { groupId, members, role } = data;
    const toInsert: QueryDeepPartialEntity<GroupMembership>[] = [];
    members.forEach(contactId => {
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
      relations: ['group', 'contact', 'contact.person'],
    });
    return this.toDto(data);
  }

  async update(dto: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    const update = await this.connection
      .createQueryBuilder()
      .update(GroupMembership)
      .set({
        role: dto.role,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    Logger.log(`Updated data ${update.affected} ${JSON.stringify(update.raw)}`);
    return await this.findOne(dto.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
