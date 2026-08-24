import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Connection, EntityManager, In, Repository } from 'typeorm';
import GroupMembership from '../entities/groupMembership.entity';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { getPersonFullName } from '../../crm/crm.helpers';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import BatchGroupMembershipDto from '../dto/membership/batch-group-membership.dto';
import { hasNoValue, hasValue } from '../../utils/validation';
import Group from '../entities/group.entity';
import Contact from '../../crm/entities/contact.entity';
import { GroupRole } from '../enums/groupRole';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

@Injectable()
export class GroupsMembershipService {
  private readonly repository: Repository<GroupMembership>;
  private readonly groupRepository: Repository<Group>;
  private readonly contactRepository: Repository<Contact>;
  private readonly connection: Connection;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly appLogger: AppLogger,
    private readonly tenantContext: TenantContext,
  ) {
    this.repository = connection.getRepository(GroupMembership);
    this.groupRepository = connection.getRepository(Group);
    this.contactRepository = connection.getRepository(Contact);
    this.connection = connection;
    this.logger = this.appLogger.createContextLogger('GroupsMembershipService');
  }

  async findAll(
    req: GroupMembershipSearchDto,
  ): Promise<{ data: GroupMembershipDto[]; total: number }> {
    const filter: Record<string, any> = {};

    if (hasValue(req.contactId)) {
      filter.contactId = req.contactId;
    }

    let groupIds: number[] = [];
    if (hasValue(req.groupId)) {
      const numericGroupId = Number(req.groupId);
      const parentGroup = await this.groupRepository.findOne({
        where: { id: numericGroupId },
        select: ['id'],
      });
      if (!parentGroup) {
        throw new ClientFriendlyException(`Invalid groupId: ${req.groupId}`);
      }
      const descendants = await this.findDescendantGroupIds(parentGroup.id);
      groupIds = [numericGroupId, ...descendants];
      filter.groupId = In(groupIds);
    }

    if (hasNoValue(filter)) {
      throw new ClientFriendlyException('Please specify groupId or contactId');
    }

    const activeOnly =
      !req.hasOwnProperty('includeInactive') || !req.includeInactive;
    if (activeOnly) {
      filter.isActive = true;
    }

    if (hasValue(req.groupId)) {
      // Two-step: paginate distinct contactIds first so that limit/skip count
      // unique contacts rather than raw membership rows (a contact in multiple
      // sub-groups would otherwise consume multiple row slots per page).
      const buildQb = () => {
        const qb = this.repository
          .createQueryBuilder('m')
          .where('m.groupId IN (:...groupIds)', { groupIds });
        if (activeOnly) {
          qb.andWhere('m.isActive = :isActive', { isActive: true });
        }
        if (hasValue(req.contactId)) {
          qb.andWhere('m.contactId = :contactId', {
            contactId: req.contactId,
          });
        }
        return qb;
      };

      const [totalResult, rows] = await Promise.all([
        buildQb()
          .select('COUNT(DISTINCT m.contactId)', 'count')
          .getRawOne<{ count: string }>(),
        buildQb()
          .select('m.contactId', 'contactId')
          .groupBy('m.contactId')
          .orderBy('m.contactId', 'ASC')
          .offset(req.skip ?? 0)
          .limit(req.limit ?? 100)
          .getRawMany<{ contactId: number }>(),
      ]);
      const total = Number(totalResult?.count ?? 0);

      if (rows.length === 0) return { data: [], total };

      const contactIds = rows.map((r) => r.contactId);
      const data = await this.repository.find({
        relations: ['contact', 'contact.person', 'group', 'group.category'],
        where: { ...filter, contactId: In(contactIds) },
        order: { id: 'ASC' },
      });

      const best = new Map<number, GroupMembership>();
      for (const m of data) {
        const prior = best.get(m.contactId);
        if (!prior || m.groupId === req.groupId) {
          best.set(m.contactId, m);
        }
      }
      return {
        data: [...best.values()].map((it) => this.toDto(it, req.groupId ?? 0)),
        total,
      };
    }

    const [data, total] = await this.repository.findAndCount({
      relations: ['contact', 'contact.person', 'group', 'group.category'],
      where: filter,
      order: { id: 'ASC' },
      skip: req.skip ?? 0,
      take: req.limit ?? 100,
    });

    return {
      data: data.map((it) => this.toDto(it, req.groupId ?? 0)),
      total,
    };
  }

  private async findDescendantGroupIds(groupId: number): Promise<number[]> {
    const descendantIds: number[] = [];
    const queue = [groupId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) continue;

      const children = await this.groupRepository.find({
        where: { parentId: currentId },
        select: ['id'],
      });

      for (const child of children) {
        if (!descendantIds.includes(child.id)) {
          descendantIds.push(child.id);
          queue.push(child.id);
        }
      }
    }

    return descendantIds;
  }

  toDto(membership: GroupMembership, refGroupId: number): GroupMembershipDto {
    const { group, contact, ...rest } = membership;
    return {
      ...rest,
      isInferred: hasValue(refGroupId) && membership.groupId !== refGroupId,
      group: group ? { name: group.name, id: group.id } : undefined,
      category: group?.category
        ? { name: group.category.name, id: group.category.id }
        : undefined,
      contact: {
        name: contact?.person ? getPersonFullName(contact.person) : '',
        id: contact?.id,
      },
      joinedAt: membership.joinedAt,
      leftAt: membership.leftAt,
      isActive: membership.isActive,
    } as GroupMembershipDto;
  }

  /**
   * Creates/reactivates group memberships. Accepts an optional `manager` so
   * callers that run their own transaction (e.g. ContactsService.create()
   * from within createMany()'s per-row transaction) can have this write
   * participate in that same transaction. Without this, the membership
   * insert would run against the default connection and either fail to see
   * the just-saved, not-yet-committed contact row (foreign key violation),
   * or commit independently of the contact save — breaking the per-row
   * all-or-nothing rollback guarantee. When no manager is supplied, the
   * service's default repository is used, preserving existing behavior for
   * every other call site.
   * 
   * Tenant-scoped: the target group must belong to the caller's current
   * tenant. Without this check, a request could supply a groupId
   * belonging to a different tenant and attach a contact to it, crossing
   * tenant boundaries.
   */
  async create(
    data: BatchGroupMembershipDto,
    manager?: EntityManager,
  ): Promise<number> {
    const repository = manager
      ? manager.getRepository(GroupMembership)
      : this.repository;
     const groupRepository = manager
      ? manager.getRepository(Group)
      : this.groupRepository;
     const contactRepository = manager
      ? manager.getRepository(Contact)
      : this.contactRepository;
    const { groupId, members, role } = data;
    const uniqueMemberIds = [...new Set(members)];

    if (uniqueMemberIds.length === 0) {
      throw new BadRequestException('At least one member is required');
    }
    const tenantId = this.tenantContext.requireTenant();
    const group = await groupRepository.findOne({
      where: { id: groupId, tenant: { id: tenantId } },
    });
    if (!group) {
      throw new BadRequestException(
        `Group ${groupId} does not exist for this tenant`,
      );
    }
    // Tenant-scoped contact validation — without this, a caller could
    // supply a contactId belonging to a different tenant and attach it
    // to a group in the current tenant, crossing tenant boundaries.
    // Uses the transaction-scoped repository (when supplied) so a
    // contact just saved earlier in the same transaction is visible
    // here even though it isn't committed yet.
    const tenantContacts = await contactRepository.find({
      where: { id: In(uniqueMemberIds), tenant: { id: tenantId } },
      select: ['id'],
    });
    const tenantContactIds = new Set(tenantContacts.map((c) => c.id));
    const foreignOrMissingIds = uniqueMemberIds.filter(
      (id) => !tenantContactIds.has(id),
    );
    if (foreignOrMissingIds.length > 0) {
      throw new BadRequestException(
        `Contact(s) ${foreignOrMissingIds.join(
          ', ',
        )} do not exist for this tenant`,
      );
    }
    const existing = await repository.find({
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
          found.role = role ?? GroupRole.Member;
          toReactivate.push(found);
        }
        // already active — skip
      } else {
        toCreate.push(
          repository.create({ groupId, contactId, role, isActive: true }),
        );
      }
    }

    const saved = await repository.save([...toReactivate, ...toCreate]);

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
      .andWhere('groupId = :groupId', { groupId: dto.groupId })
      .execute();
    Logger.log(`Updated data ${update.affected} ${JSON.stringify(update.raw)}`);
    return await this.findOne(dto.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
