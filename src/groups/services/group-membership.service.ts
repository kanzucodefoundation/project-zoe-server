import { Injectable, Put, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository, Like } from 'typeorm';
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
    const { groupId, contactId, role, isActive } = data;
    // query that selects where membership.groupId = groupId and membership.contactId = contactId
    const resp = await this.repository
      .find({
        select: ['id', 'isActive'],
        where: [
          {
            groupId: groupId,
            contactId: contactId,
          },
        ],
      });
    if (resp.length > 0) {
      // If volunteer is currently inactive in the selected ministry, update their status to active ie. from 0 to 1
      const update = await this.connection.createQueryBuilder()
        .update(GroupMembership)
        .set({
          isActive: true,
        })
        .where('groupId = :groupId', { groupId: groupId })
        .andWhere('contactId = :contactId', { contactId: contactId })
        .execute();
      if (update.affected >= 1)
        return await this.findOne(resp[0].id);
      throw  new ClientFriendlyException('Update failed');
    } else {
      // Never been in the selected ministry, therefore add this new entry to the table
      membership.groupId = groupId;
      membership.contactId = contactId;
      membership.role = role;
      membership.isActive = isActive;
      const created = await this.repository.save(membership);
      return await this.findOne(created.id);
    }
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
        // groupId: dto.groupId,
        role: dto.role,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (update.affected >= 1)
      return await this.findOne(dto.id);
    throw  new ClientFriendlyException('Update failed');
  }

  async updateIsActive(dto: UpdateGroupMembershipDto): Promise<GroupMembershipDto> {
    const update = await this.connection.createQueryBuilder()
      .update(GroupMembership)
      .set({
        isActive: dto.isActive,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (update.affected >= 1) {
      this.updateVolunteerStatus(dto.contactId)
      return await this.findOne(dto.id);
    }
    throw  new ClientFriendlyException('Update failed');
  }

  // Update the User table to make a volunteer inactive if they are inactive in all ministries within Group Membership and active when they active in all ministries
  async updateVolunteerStatus(contactId: number) {
    const resp = await this.repository
      .find({
        select: ['isActive'],
        where: [
          {
            contactId: contactId,
            role: 'Volunteer',
          },
        ],
      });
    console.log("RESP----------------->", resp);
    // for (let i = 0; i < resp.length; i++) {
    //   if (resp[i].isActive === false) {

    //   }
    // }
    // if (resp.length > 0) {
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
