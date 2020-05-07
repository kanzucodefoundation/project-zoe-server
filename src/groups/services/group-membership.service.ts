import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { hasNoValue, hasValue } from '../../utils/basicHelpers';
import GroupMembership from '../entities/groupMembership.entity';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { getPersonFullName } from '../../crm/crm.helpers';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import { CreateGroupMembershipDto } from '../dto/membership/create-group-membership.dto';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';

@Injectable()
export class GroupsMembershipService {
  constructor(
    @InjectRepository(GroupMembership)
    private readonly repository: Repository<GroupMembership>,
    private connection: Connection,
  ) {
  }

  async findAll(req: GroupMembershipSearchDto): Promise<GroupMembershipDto[]> {
    const filter: FindConditions<GroupMembership> = {};
    if (hasValue(req.contactId)) {
      filter.contactId = req.contactId;
    }
    if (hasValue(req.groupId)) {
      filter.groupId = req.groupId;
    }
    if (hasNoValue(filter))
      throw  new ClientFriendlyException('Invalid query');
    const data = await this.repository.find({
      relations: ['group', 'contact', 'contact.person'],
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
      group: { name: group.name, id: group.id },
      contact: { name: getPersonFullName(contact.person), id: contact.id },
    };
  }

  async create(data: CreateGroupMembershipDto): Promise<GroupMembershipDto> {
    const membership = new GroupMembership();
    const { groupId, contactId, role } = data;
    membership.groupId = groupId;
    membership.contactId = contactId;
    membership.role = role;
    const created = await this.repository.save(membership);
    return await this.findOne(created.id);
  }

  async findOne(id: number): Promise<GroupMembershipDto> {
    const data = await this.repository.findOne(id, {
      relations: ['group', 'contact', 'contact.person'],
    });
    return this.toDto(data);
  }

  async update(dto: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    const update = await this.connection.createQueryBuilder()
      .update(GroupMembership)
      .set({
        role: dto.role,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (update.affected >= 1)
      return await this.findOne(dto.id);
    throw  new ClientFriendlyException('Update failed');
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
