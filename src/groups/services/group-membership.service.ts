import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Connection, In, Repository, TreeRepository } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { getPersonFullName } from '../../crm/crm.helpers';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import BatchGroupMembershipDto from '../dto/membership/batch-group-membership.dto';
import { hasNoValue, hasValue } from '../../utils/validation';
import Group from '../entities/group.entity';
import { GroupRole } from '../enums/groupRole';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';

@Injectable()
export class GroupsMembershipService {
  private readonly repository: Repository<GroupMembership>;
  private readonly groupTreeRepository: TreeRepository<Group>;
  private readonly connection: Connection;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(GroupMembership);
    this.groupTreeRepository = connection.getTreeRepository(Group);
    this.connection = connection;
    this.logger = this.appLogger.createContextLogger('GroupsMembershipService');
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
      throw new ClientFriendlyException('Please specify groupId or contactId');
    }

    // By default, only show active memberships unless explicitly requested
    if (!req.hasOwnProperty('includeInactive') || !req.includeInactive) {
      filter.isActive = true;
    }

    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'group', 'group.category'],
      skip: req.skip ?? 0,
      take: req.limit ?? 100,
      where: filter,
    });
    return data.map((it) => this.toDto(it, req.groupId));
  }

  toDto(membership: GroupMembership, refGroupId: number): GroupMembershipDto {
    const { group, contact, ...rest } = membership;
    return {
      ...rest,
      isInferred: hasValue(refGroupId) && membership.groupId !== refGroupId,
      group: group ? { name: group.name, id: group.id } : null,
      category: group.category
        ? { name: group.category.name, id: group.category.id }
        : null,
      contact: { name: getPersonFullName(contact.person), id: contact.id },
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
      isActive: membership.isActive,
    };
  }

  async create(data: BatchGroupMembershipDto): Promise<number> {
    const { groupId, members, role } = data;
    const uniqueMemberIds = [...new Set(members)];

    if (uniqueMemberIds.length === 0) {
      throw new BadRequestException('At least one member is required');
    }

    const existing = await this.repository.find({
      where: uniqueMemberIds.map((contactId) => ({ contactId, groupId })),
    });
    const existingByContactId = new Map(existing.map((m) => [m.contactId, m]));

    if (role !== GroupRole.Leader) {
      const conflictingLeaderIds = existing
        .filter((m) => m.role === GroupRole.Leader && m.isActive)
        .map((m) => m.contactId);
      if (conflictingLeaderIds.length > 0) {
        throw new BadRequestException(
          `Contact(s) ${conflictingLeaderIds.join(
            ', ',
          )} are already leaders of this group and cannot be added as members`,
        );
      }
    }

    const toReactivate: GroupMembership[] = [];
    const toCreate: GroupMembership[] = [];

    for (const contactId of uniqueMemberIds) {
      const found = existingByContactId.get(contactId);
      if (found) {
        if (!found.isActive) {
          found.isActive = true;
          found.leftAt = null;
          found.role = role;
          toReactivate.push(found);
        }
        // already active — skip
      } else {
        toCreate.push(
          this.repository.create({ groupId, contactId, role, isActive: true }),
        );
      }
    }

    const saved = await this.repository.save([...toReactivate, ...toCreate]);

    this.logger.business('log', 'Group memberships upserted', {
      resource: 'group_membership',
      resourceId: groupId,
      metadata: {
        groupId,
        created: toCreate.length,
        reactivated: toReactivate.length,
        contactIds: saved.map((m) => m.contactId),
        role,
      },
    });

    Logger.log(
      `Upserted ${saved.length} memberships for group ${groupId} (${toCreate.length} new, ${toReactivate.length} reactivated)`,
    );
    return saved.length;
  }

  async findOne(id: number): Promise<GroupMembershipDto> {
    const data = await this.repository.findOne({
      where: { id },
      relations: ['group', 'contact', 'contact.person'],
    });
    if (!data) throw new NotFoundException(`Membership ${id} not found`);
    return this.toDto(data, 0);
  }

  async findOneGivenContact(id: number): Promise<GroupMembershipDto> {
    const data = await this.repository.findOne({
      where: { contactId: id },
      relations: ['group', 'contact', 'contact.person'],
    });
    if (!data) throw new NotFoundException(`No membership for contact ${id}`);
    return this.toDto(data, 0);
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
