import {
  BadRequestException,
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { TenantContext } from '../shared/tenant/tenant-context';
import { Tenant } from '../tenants/entities/tenant.entity';
import { intersection } from 'lodash';
import {
  getRepository,
  ILike,
  In,
  Like,
  Repository,
  Connection,
  TreeRepository,
  DeepPartial,
} from 'typeorm';
import Contact from './entities/contact.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import {
  getCellGroup,
  getEmail,
  getLocation,
  getPersonFullName,
  getPhone,
} from './crm.helpers';
import { ContactSearchDto } from './dto/contact-search.dto';
import Phone from './entities/phone.entity';
import Email from './entities/email.entity';
import Person from './entities/person.entity';
import Company from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { hasNoValue, hasValue } from 'src/utils/validation';
import Address from './entities/address.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { GroupRole } from '../groups/enums/groupRole';
import { roleAdmin } from '../auth/constants';
import ContactListDto from './dto/contact-list.dto';
import Group from '../groups/entities/group.entity';
import { GoogleService } from 'src/vendor/google.service';
import GooglePlaceDto from 'src/vendor/google-place.dto';
import { getPreciseDistance } from 'geolib';
import GroupMembershipRequest from 'src/groups/entities/groupMembershipRequest.entity';
import { IEmail, sendEmail } from 'src/utils/mailer';
import {
  GetClosestGroupDto,
  GetGroupResponseDto,
} from 'src/groups/dto/membershipRequest/new-request.dto';
import { getContactModel } from './utils/creationUtils';
import { GroupFinderService } from './group-finder/group-finder.service';
import { AddressesService } from './addresses.service';
import { GroupTreeService } from 'src/groups/services/group-tree.service';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import { groupCategories } from 'src/groups/groups.constants';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';
import { GroupsMembershipService } from 'src/groups/services/group-membership.service';

@Injectable()
export class ContactsService {
  private readonly repository: Repository<Contact>;
  private readonly personRepository: Repository<Person>;
  private readonly companyRepository: Repository<Company>;
  private readonly phoneRepository: Repository<Phone>;
  private readonly emailRepository: Repository<Email>;
  private readonly addressRepository: Repository<Address>;
  private readonly membershipRepository: Repository<GroupMembership>;
  private readonly groupRepository: TreeRepository<Group>;
  private readonly gmRequestRepository: Repository<GroupMembershipRequest>;
  private readonly tenantRepository: Repository<Tenant>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private googleService: GoogleService,
    private groupFinderService: GroupFinderService,
    private addressesService: AddressesService,
    private groupTreeService: GroupTreeService,
    private appLogger: AppLogger,
    private groupsMembershipService: GroupsMembershipService,
    private tenantContext: TenantContext,
  ) {
    this.repository = connection.getRepository(Contact);
    this.personRepository = connection.getRepository(Person);
    this.companyRepository = connection.getRepository(Company);
    this.phoneRepository = connection.getRepository(Phone);
    this.emailRepository = connection.getRepository(Email);
    this.addressRepository = connection.getRepository(Address);
    this.membershipRepository = connection.getRepository(GroupMembership);
    this.groupRepository = connection.getTreeRepository(Group);
    this.gmRequestRepository = connection.getRepository(GroupMembershipRequest);
    this.tenantRepository = connection.getRepository(Tenant);
    this.logger = this.appLogger.createContextLogger('ContactsService');
  }

  private static escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, (match) => `\\${match}`);
  }

  async findAll(req: ContactSearchDto, user?: any): Promise<ContactListDto[]> {
    const tracking = this.logger.startTracking('findAllContacts', {
      userId: user?.id,
      contactId: user?.contactId,
    });

    try {
      this.logger.business('log', 'Starting contact search', {
        operation: 'findAllContacts',
        userId: user?.id,
        contactId: user?.contactId,
        resource: 'contacts',
        metadata: {
          hasUserFilter: !!user,
          searchParams: {
            query: req.query,
            email: req.email,
            phone: req.phone,
            cellGroups: req.cellGroups?.length || 0,
            churchLocations: req.churchLocations?.length || 0,
            limit: req.limit,
            skip: req.skip,
          },
        },
      });

      let hasFilter = false;
      //This will hold the query id list
      let idList: number[] = [];
      const groups = [
        ...(req.cellGroups || []),
        ...(req.churchLocations || []),
      ];
      if (hasValue(groups)) {
        this.logger.dataAccess('log', 'Filtering contacts by groups', {
          operation: 'findAllContacts',
          userId: user?.id,
          metadata: { groupIds: groups, groupCount: groups.length },
        });
        hasFilter = true;
        const resp = await this.membershipRepository.find({
          select: ['contactId'],
          where: { groupId: In(groups) },
        });
        if (hasValue(idList)) {
          idList = intersection(
            idList,
            resp.map((it) => it.contactId),
          );
        } else {
          idList.push(...resp.map((it) => it.contactId));
        }
      }

      if (hasValue(req.query)) {
        const trimmedQuery = req.query.trim();
        if (hasValue(trimmedQuery)) {
          hasFilter = true;
          const searchTerms = trimmedQuery.split(/\s+/);
          const tenantId = this.tenantContext.requireTenant();
          const qb = this.personRepository
            .createQueryBuilder('person')
            .innerJoin('person.contact', 'contact')
            .select(['person.contactId'])
            .where('contact.tenantId = :tenantId', { tenantId });
          // Dynamically add an AND condition for every word keyword typed
          searchTerms.forEach((term, index) => {
            const condition = `(person.firstName ILIKE :term${index} OR person.lastName ILIKE :term${index} OR person.middleName ILIKE :term${index})`;
            const params = {
              [`term${index}`]: `%${ContactsService.escapeLike(term)}%`,
            };
            qb.andWhere(condition, params);
          });
          const resp = await qb.getMany();
          this.logger.dataAccess('debug', 'Name search results found', {
            operation: 'findAllContacts',
            userId: user?.id,
            metadata: {
              nameSearchResultCount: resp.length,
              queryLength: trimmedQuery.length,
            },
          });
          if (hasValue(idList)) {
            idList = intersection(
              idList,
              resp.map((it) => it.contactId),
            );
          } else {
            idList.push(...resp.map((it) => it.contactId));
          }
        }
      }

      if (hasValue(req.phone)) {
        hasFilter = true;
        const resp = await this.phoneRepository.find({
          select: ['contactId'],
          where: { value: Like(`%${req.phone}%`) },
        });
        this.logger.dataAccess('debug', 'Phone search results found', {
          operation: 'findAllContacts',
          userId: user?.id,
          metadata: { phoneSearchResultCount: resp.length, phone: req.phone },
        });
        if (hasValue(idList)) {
          idList = intersection(
            idList,
            resp.map((it) => it.contactId),
          );
        } else {
          idList.push(...resp.map((it) => it.contactId));
        }
      }

      if (hasValue(req.email)) {
        hasFilter = true;
        const resp = await this.emailRepository.find({
          select: ['contactId'],
          where: { value: ILike(`%${req.email.trim().toLowerCase()}%`) },
        });
        this.logger.dataAccess('debug', 'Email search results found', {
          operation: 'findAllContacts',
          userId: user?.id,
          metadata: { emailSearchResultCount: resp.length, email: req.email },
        });
        if (hasValue(idList)) {
          idList = intersection(
            idList,
            resp.map((it) => it.contactId),
          );
        } else {
          idList.push(...resp.map((it) => it.contactId));
        }
      }

      this.logger.business(
        'debug',
        'Contact ID list built from search filters',
        {
          operation: 'findAllContacts',
          userId: user?.id,
          metadata: {
            contactIdCount: idList.length,
            hasSearchFilter: hasFilter,
          },
        },
      );

      if (hasFilter && hasNoValue(idList)) {
        this.logger.business(
          'log',
          'No contacts found matching search criteria',
          {
            operation: 'findAllContacts',
            userId: user?.id,
            metadata: { reason: 'empty_search_results' },
          },
        );
        this.logger.endTracking(tracking, true);
        return [];
      }

      // Apply user permission filtering
      if (user) {
        const isAdmin =
          Array.isArray(user.roles) && user.roles.includes(roleAdmin.role);

        if (isAdmin) {
          this.logger.security(
            'log',
            'Admin user - skipping permission filter',
            {
              operation: 'findAllContacts',
              userId: user?.id,
              contactId: user?.contactId,
            },
          );
        } else {
          this.logger.security(
            'log',
            'Applying user permission filtering to contacts',
            {
              operation: 'findAllContacts',
              userId: user?.id,
              contactId: user?.contactId,
              metadata: {
                contactCountBeforeFilter: idList.length || 'unlimited',
              },
            },
          );

          const permissionFilteredIds =
            await this.getContactsInUserAccessibleGroups(user);
          if (permissionFilteredIds.length === 0) {
            this.logger.security(
              'warn',
              'User has no accessible groups - returning empty result',
              {
                operation: 'findAllContacts',
                userId: user?.id,
                contactId: user?.contactId,
              },
            );
            this.logger.endTracking(tracking, true);
            return []; // User has no accessible groups
          }

          if (hasValue(idList)) {
            const originalCount = idList.length;
            idList = intersection(idList, permissionFilteredIds);
            this.logger.security(
              'log',
              'Applied permission intersection filter',
              {
                operation: 'findAllContacts',
                userId: user?.id,
                contactId: user?.contactId,
                metadata: {
                  originalCount,
                  filteredCount: idList.length,
                  permissionGroupCount: permissionFilteredIds.length,
                },
              },
            );
          } else {
            idList = permissionFilteredIds;
            this.logger.security(
              'log',
              'Using permission filter as primary filter',
              {
                operation: 'findAllContacts',
                userId: user?.id,
                contactId: user?.contactId,
                metadata: {
                  permissionContactCount: permissionFilteredIds.length,
                },
              },
            );
          }
          hasFilter = true;
        }
      }

      if (hasFilter && hasNoValue(idList)) {
        this.logger.business('log', 'No contacts accessible to user', {
          operation: 'findAllContacts',
          userId: user?.id,
          metadata: { reason: 'permission_filtered_empty' },
        });
        this.logger.endTracking(tracking, true);
        return [];
      }

      const tenantId = this.tenantContext.requireTenant();
      const data = await this.repository.find({
        relations: [
          'person',
          'emails',
          'phones',
          'groupMemberships',
          'groupMemberships.group',
          'groupMemberships.group.category',
        ],
        skip: req.skip,
        take: req.limit,
        where: hasValue(idList)
          ? { id: In(idList), tenant: { id: tenantId } }
          : { tenant: { id: tenantId } },
      });

      this.logger.business('log', 'Contact search completed successfully', {
        operation: 'findAllContacts',
        userId: user?.id,
        contactId: user?.contactId,
        metadata: {
          resultCount: data.length,
          finalFilterApplied: hasFilter,
          paginationInfo: {
            skip: req.skip,
            limit: req.limit,
          },
        },
      });

      this.logger.endTracking(tracking, true);
      return data.map((it) => {
        return ContactsService.toListDto(it);
      });
    } catch (e) {
      this.logger.error(e instanceof Error ? e : new Error(String(e)), {
        operation: 'findAllContacts',
        userId: user?.id,
        contactId: user?.contactId,
        resource: 'contacts',
      });
      this.logger.endTracking(tracking, false);
      return [];
    }
  }

  public static toListDto(it: Contact): ContactListDto {
    const cellGroup = getCellGroup(it);
    const location = getLocation(it);
    return {
      id: it.id,
      name: getPersonFullName(it.person),
      avatar: it.person.avatar,
      ageGroup: it.person.ageGroup,
      dateOfBirth: it.person.dateOfBirth,
      email: getEmail(it),
      phone: getPhone(it),
      status: it.status,
      cellGroup: hasValue(cellGroup)
        ? { id: cellGroup.id, name: cellGroup.name }
        : null,
      location: hasValue(location)
        ? { id: location.id, name: location.name }
        : null,
    };
  }

  async create(data: Contact, request?: any): Promise<Contact> {
    const tracking = this.logger.startTracking('createContact', {
      userId: request?.user?.id,
      contactId: request?.user?.contactId,
    });

    try {
      this.logger.business('log', 'Starting contact creation', {
        operation: 'createContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resource: 'contacts',
        metadata: {
          hasGroupAssignments: !!(
            (data as any).groups && (data as any).groups.length > 0
          ),
          groupAssignmentsCount: (data as any).groups?.length || 0,
          receivedGroups: (data as any).groups,
          allReceivedKeys: Object.keys(data),
          dataType: typeof data,
        },
      });

      // Set tenant from request context if not already set
      if (!data.tenant && request?.tenant) {
        data.tenant = request.tenant;
      }

      const savedContact = await this.repository.save(data);

      this.logger.business('log', 'Contact created successfully', {
        operation: 'createContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: savedContact.id,
        metadata: { contactId: savedContact.id },
      });

      // Handle group membership assignments
      const groupAssignments = (data as any).groups || [];

      if (groupAssignments.length === 0) {
        throw new BadRequestException(
          'Contact must be assigned to at least one group',
        );
      }

      this.logger.business('log', 'Assigning contact to groups', {
        operation: 'createContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: savedContact.id,
        metadata: {
          groupAssignments: groupAssignments.map((g) => ({
            groupId: g.groupId,
            role: g.role,
          })),
          targetContactId: savedContact.id,
        },
      });

      for (const assignment of groupAssignments) {
        try {
          await this.groupsMembershipService.create({
            groupId: assignment.id,
            members: [savedContact.id],
            role: assignment.role || GroupRole.Member,
          });

          this.logger.business(
            'log',
            'Group membership assigned successfully',
            {
              operation: 'createContact',
              userId: request?.user?.id,
              contactId: request?.user?.contactId,
              resourceId: savedContact.id,
              metadata: {
                groupId: assignment.id,
                role: assignment.role || GroupRole.Member,
                targetContactId: savedContact.id,
              },
            },
          );
        } catch (membershipError) {
          this.logger.error(membershipError, {
            operation: 'createContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: savedContact.id,
            metadata: {
              groupId: assignment.id,
              role: assignment.role || GroupRole.Member,
              targetContactId: savedContact.id,
              stage: 'group_membership_assignment',
            },
          });

          // For creation, we want to fail if any group assignment fails
          throw new BadRequestException(
            `Failed to assign contact to group ${assignment.id}: ${membershipError.message}`,
          );
        }
      }

      this.logger.endTracking(tracking, true);
      return savedContact;
    } catch (error) {
      this.logger.error(error, {
        operation: 'createContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resource: 'contacts',
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async update(data: Contact): Promise<Contact> {
    return await this.repository.save(data);
  }

  async updatePartial(
    id: number,
    data: Partial<Contact>,
    request?: any,
  ): Promise<Contact> {
    const tracking = this.logger.startTracking('updateContact', {
      userId: request?.user?.id,
      contactId: request?.user?.contactId,
      resourceId: id,
    });

    try {
      this.logger.business('log', 'Starting contact update', {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: id,
        metadata: {
          hasGroupAssignments: !!(data as any).groups,
          groupAssignmentsCount: (data as any).groups?.length || 0,
          updateFields: Object.keys(data),
        },
      });

      // Input validation
      this.validateUpdateData(data);

      const existingContact = await this.repository.findOne({
        where: { id },
        relations: [
          'person',
          'emails',
          'phones',
          'addresses',
          'groupMemberships',
        ],
      });

      if (!existingContact) {
        this.logger.business('error', 'Contact not found for update', {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: id,
        });
        throw new BadRequestException('Contact not found');
      }

      // Handle nested person update
      if (data.person) {
        if (existingContact.person) {
          Object.assign(existingContact.person, data.person);
        } else {
          const person = this.personRepository.create(data.person);
          person.contactId = existingContact.id;
          existingContact.person = person;
        }
      }

      // Handle emails update with efficient upsert
      if (data.emails) {
        await this.updateEmailsEfficiently(existingContact, data.emails);
      }

      // Handle phones update with efficient upsert
      if (data.phones) {
        await this.updatePhonesEfficiently(existingContact, data.phones);
      }

      // Handle addresses update with efficient upsert
      if (data.addresses) {
        await this.updateAddressesEfficiently(existingContact, data.addresses);
      }

      // Handle other contact fields (excluding nested entities and group assignment)
      const {
        person,
        emails,
        phones,
        addresses,
        groupId: _,
        role: __,
        ...contactData
      } = data as any;
      if (Object.keys(contactData).length > 0) {
        Object.assign(existingContact, contactData);
      }

      try {
        // Save the contact first (without group memberships to avoid constraint issues)
        const savedContact = await this.repository.save(existingContact);

        // Handle group membership updates after contact is saved
        const groups = (data as any).groups;

        if (groups !== undefined) {
          // Reload contact to get fresh group memberships
          const contactWithMemberships = await this.repository.findOne({
            where: { id: savedContact.id },
            relations: ['groupMemberships'],
          });

          await this.handleGroupMembershipsUpdate(
            contactWithMemberships,
            groups,
            request,
          );
        }

        this.logger.business('log', 'Contact updated successfully', {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: id,
          metadata: { contactId: savedContact.id },
        });

        this.logger.endTracking(tracking, true);
        return await this.findOne(savedContact.id);
      } catch (error) {
        this.logger.error(error, {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: id,
        });
        this.logger.endTracking(tracking, false);
        throw new BadRequestException(
          `Failed to update contact: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(error, {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: id,
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  /**
   * Handle multiple group membership updates for a contact
   */
  private async handleGroupMembershipsUpdate(
    contact: Contact,
    newGroups: Array<{ id: number; role?: GroupRole }>,
    request?: any,
  ): Promise<void> {
    try {
      const contactId = contact.id;
      const currentMemberships = contact.groupMemberships || [];

      this.logger.business(
        'log',
        'Processing multiple group memberships update',
        {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contactId,
          metadata: {
            newGroupsCount: newGroups.length,
            newGroups: newGroups.map((g) => ({
              groupId: g.id,
              role: g.role || GroupRole.Member,
            })),
            currentMembershipsCount: currentMemberships.length,
          },
        },
      );

      // If no groups provided, validate business rule (contacts must have at least one group)
      if (!newGroups || newGroups.length === 0) {
        throw new BadRequestException(
          'Contact must be assigned to at least one group',
        );
      }

      // Get current active memberships
      const activeMemberships = currentMemberships.filter(
        (m) => m.isActive !== false,
      );

      // Create sets for comparison
      const newGroupIds = new Set(newGroups.map((g) => g.id));
      const currentGroupIds = new Set(activeMemberships.map((m) => m.groupId));

      // Groups to add (in newGroups but not in current active)
      const groupsToAdd = newGroups.filter((g) => !currentGroupIds.has(g.id));

      // Groups to remove (in current active but not in newGroups)
      const membershipsToDeactivate = activeMemberships.filter(
        (m) => !newGroupIds.has(m.groupId),
      );

      // Groups to update role (in both, but role might be different)
      const groupsToUpdate = newGroups.filter((g) => {
        const currentMembership = activeMemberships.find(
          (m) => m.groupId === g.id,
        );
        return (
          currentMembership &&
          currentMembership.role !== (g.role || GroupRole.Member)
        );
      });

      this.logger.business('log', 'Group membership changes calculated', {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: contactId,
        metadata: {
          groupsToAdd: groupsToAdd.length,
          membershipsToDeactivate: membershipsToDeactivate.length,
          groupsToUpdate: groupsToUpdate.length,
        },
      });

      // Deactivate memberships that should be removed
      for (const membership of membershipsToDeactivate) {
        this.logger.business('log', 'Deactivating group membership', {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contactId,
          metadata: {
            membershipId: membership.id,
            groupId: membership.groupId,
            oldRole: membership.role,
          },
        });

        await this.membershipRepository
          .createQueryBuilder()
          .update(GroupMembership)
          .set({
            isActive: false,
            leftAt: () => 'CURRENT_TIMESTAMP',
          })
          .where('id = :id', { id: membership.id })
          .execute();
      }

      // Update roles for existing groups
      for (const groupUpdate of groupsToUpdate) {
        const currentMembership = activeMemberships.find(
          (m) => m.groupId === groupUpdate.id,
        );
        const newRole = groupUpdate.role || GroupRole.Member;

        this.logger.business('log', 'Updating role in existing group', {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contactId,
          metadata: {
            membershipId: currentMembership.id,
            groupId: groupUpdate.id,
            oldRole: currentMembership.role,
            newRole: newRole,
          },
        });

        await this.membershipRepository
          .createQueryBuilder()
          .update(GroupMembership)
          .set({ role: newRole })
          .where('id = :id', { id: currentMembership.id })
          .execute();
      }

      // Add new group memberships
      for (const groupToAdd of groupsToAdd) {
        const targetRole = groupToAdd.role || GroupRole.Member;

        // Check if there's an inactive membership for this group we can reactivate
        const inactiveMembership = currentMemberships.find(
          (m) => m.groupId === groupToAdd.id && m.isActive === false,
        );

        if (inactiveMembership) {
          this.logger.business('log', 'Reactivating previous membership', {
            operation: 'updateContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: contactId,
            metadata: {
              membershipId: inactiveMembership.id,
              groupId: groupToAdd.id,
              role: targetRole,
            },
          });

          await this.membershipRepository
            .createQueryBuilder()
            .update(GroupMembership)
            .set({
              isActive: true,
              role: targetRole,
              leftAt: null,
              joinedAt: () => 'CURRENT_TIMESTAMP',
            })
            .where('id = :id', { id: inactiveMembership.id })
            .execute();
        } else {
          this.logger.business('log', 'Creating new group membership', {
            operation: 'updateContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: contactId,
            metadata: {
              groupId: groupToAdd.id,
              role: targetRole,
            },
          });

          await this.groupsMembershipService.create({
            groupId: groupToAdd.id,
            members: [contactId],
            role: targetRole,
          });
        }
      }

      this.logger.business(
        'log',
        'Multiple group memberships update completed successfully',
        {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contactId,
          metadata: {
            finalGroupsCount: newGroups.length,
            changesApplied: {
              added: groupsToAdd.length,
              removed: membershipsToDeactivate.length,
              updated: groupsToUpdate.length,
            },
          },
        },
      );
    } catch (membershipError) {
      this.logger.error(membershipError, {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: contact.id,
        metadata: {
          stage: 'group_memberships_update',
        },
      });

      throw new BadRequestException(
        `Failed to update group memberships: ${membershipError.message}`,
      );
    }
  }

  /**
   * Handle group membership updates for a contact (legacy single group method)
   */
  private async handleGroupMembershipUpdate(
    contact: Contact,
    newGroupId: number | null,
    newRole?: GroupRole,
    request?: any,
  ): Promise<void> {
    try {
      const contactId = contact.id;
      const currentMemberships = contact.groupMemberships || [];

      this.logger.business('log', 'Processing group membership update', {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: contactId,
        metadata: {
          newGroupId,
          newRole: newRole || GroupRole.Member,
          currentMembershipsCount: currentMemberships.length,
        },
      });

      // If newGroupId is null or 0, deactivate all active memberships
      if (!newGroupId) {
        const activeMemberships = currentMemberships.filter(
          (m) => m.isActive !== false,
        );
        if (activeMemberships.length > 0) {
          this.logger.business('log', 'Deactivating all group memberships', {
            operation: 'updateContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: contactId,
            metadata: {
              membershipIdsToDeactivate: activeMemberships.map((m) => m.id),
              groupsToLeave: activeMemberships.map((m) => m.groupId),
            },
          });

          for (const membership of activeMemberships) {
            await this.membershipRepository
              .createQueryBuilder()
              .update(GroupMembership)
              .set({
                isActive: false,
                leftAt: () => 'CURRENT_TIMESTAMP',
              })
              .where('id = :id', { id: membership.id })
              .execute();
          }
        }
        return;
      }

      const targetRole = newRole || GroupRole.Member;

      // Get current active membership (only consider active ones)
      const activeMemberships = currentMemberships.filter(
        (m) => m.isActive !== false,
      );

      if (activeMemberships.length > 0) {
        const currentMembership = activeMemberships[0];

        // Check if this is the same group
        if (currentMembership.groupId === newGroupId) {
          // Same group - just update role if different
          if (currentMembership.role !== targetRole) {
            this.logger.business('log', 'Updating role in same group', {
              operation: 'updateContact',
              userId: request?.user?.id,
              contactId: request?.user?.contactId,
              resourceId: contactId,
              metadata: {
                membershipId: currentMembership.id,
                groupId: newGroupId,
                oldRole: currentMembership.role,
                newRole: targetRole,
              },
            });

            await this.membershipRepository
              .createQueryBuilder()
              .update(GroupMembership)
              .set({ role: targetRole })
              .where('id = :id', { id: currentMembership.id })
              .execute();
          } else {
            this.logger.business(
              'debug',
              'Group membership unchanged - same group and role',
              {
                operation: 'updateContact',
                userId: request?.user?.id,
                contactId: request?.user?.contactId,
                resourceId: contactId,
                metadata: {
                  groupId: newGroupId,
                  role: targetRole,
                  membershipId: currentMembership.id,
                },
              },
            );
          }
        } else {
          // Different group - mark current as left, create/reactivate new one
          this.logger.business(
            'log',
            'Moving to different group - marking current membership as left',
            {
              operation: 'updateContact',
              userId: request?.user?.id,
              contactId: request?.user?.contactId,
              resourceId: contactId,
              metadata: {
                oldMembershipId: currentMembership.id,
                oldGroupId: currentMembership.groupId,
                newGroupId: newGroupId,
                newRole: targetRole,
              },
            },
          );

          // Mark current membership as left
          await this.membershipRepository
            .createQueryBuilder()
            .update(GroupMembership)
            .set({
              isActive: false,
              leftAt: () => 'CURRENT_TIMESTAMP',
            })
            .where('id = :id', { id: currentMembership.id })
            .execute();

          // Check if there's an inactive membership for the new group that we can reactivate
          const inactiveMembershipForNewGroup = currentMemberships.find(
            (m) => m.groupId === newGroupId && m.isActive === false,
          );

          if (inactiveMembershipForNewGroup) {
            this.logger.business(
              'log',
              'Reactivating previous membership for target group',
              {
                operation: 'updateContact',
                userId: request?.user?.id,
                contactId: request?.user?.contactId,
                resourceId: contactId,
                metadata: {
                  membershipId: inactiveMembershipForNewGroup.id,
                  groupId: newGroupId,
                  role: targetRole,
                },
              },
            );

            // Reactivate the existing membership
            await this.membershipRepository
              .createQueryBuilder()
              .update(GroupMembership)
              .set({
                isActive: true,
                role: targetRole,
                leftAt: null,
                joinedAt: () => 'CURRENT_TIMESTAMP',
              })
              .where('id = :id', { id: inactiveMembershipForNewGroup.id })
              .execute();
          } else {
            // Create completely new membership
            this.logger.business(
              'log',
              'Creating new group membership for different group',
              {
                operation: 'updateContact',
                userId: request?.user?.id,
                contactId: request?.user?.contactId,
                resourceId: contactId,
                metadata: { groupId: newGroupId, role: targetRole },
              },
            );

            await this.groupsMembershipService.create({
              groupId: newGroupId,
              members: [contactId],
              role: targetRole,
            });
          }
        }

        // Handle any additional active memberships (should only be one active)
        const otherActiveMemberships = activeMemberships.slice(1);
        if (otherActiveMemberships.length > 0) {
          this.logger.business(
            'log',
            'Deactivating additional active memberships',
            {
              operation: 'updateContact',
              userId: request?.user?.id,
              contactId: request?.user?.contactId,
              resourceId: contactId,
              metadata: {
                membershipIdsToDeactivate: otherActiveMemberships.map(
                  (m) => m.id,
                ),
              },
            },
          );

          for (const membership of otherActiveMemberships) {
            await this.membershipRepository
              .createQueryBuilder()
              .update(GroupMembership)
              .set({
                isActive: false,
                leftAt: () => 'CURRENT_TIMESTAMP',
              })
              .where('id = :id', { id: membership.id })
              .execute();
          }
        }
      } else {
        // No active memberships - check if there's an inactive one to reactivate
        const inactiveMembershipForGroup = currentMemberships.find(
          (m) => m.groupId === newGroupId && m.isActive === false,
        );

        if (inactiveMembershipForGroup) {
          this.logger.business('log', 'Reactivating previous membership', {
            operation: 'updateContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: contactId,
            metadata: {
              membershipId: inactiveMembershipForGroup.id,
              groupId: newGroupId,
              role: targetRole,
            },
          });

          // Reactivate existing membership
          await this.membershipRepository
            .createQueryBuilder()
            .update(GroupMembership)
            .set({
              isActive: true,
              role: targetRole,
              leftAt: null,
              joinedAt: () => 'CURRENT_TIMESTAMP',
            })
            .where('id = :id', { id: inactiveMembershipForGroup.id })
            .execute();
        } else {
          // Create completely new membership
          this.logger.business('log', 'Creating first group membership', {
            operation: 'updateContact',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: contactId,
            metadata: { groupId: newGroupId, role: targetRole },
          });

          await this.groupsMembershipService.create({
            groupId: newGroupId,
            members: [contactId],
            role: targetRole,
          });
        }
      }

      this.logger.business(
        'log',
        'Group membership update completed successfully',
        {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contactId,
          metadata: { finalGroupId: newGroupId, finalRole: targetRole },
        },
      );
    } catch (membershipError) {
      this.logger.error(membershipError, {
        operation: 'updateContact',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: contact.id,
        metadata: {
          newGroupId,
          newRole,
          stage: 'group_membership_update',
        },
      });

      // Log warning but don't fail the contact update
      this.logger.business(
        'warn',
        'Contact updated but group membership update failed',
        {
          operation: 'updateContact',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: contact.id,
          metadata: {
            newGroupId,
            newRole,
            errorMessage: membershipError.message,
          },
        },
      );
    }
  }

  async updateWithGroups(
    id: number,
    data: any,
    request?: any,
  ): Promise<Contact> {
    const tracking = this.logger.startTracking('updateContactWithGroups', {
      userId: request?.user?.id,
      contactId: request?.user?.contactId,
      resourceId: id,
    });

    try {
      this.logger.business('log', 'Starting contact update with groups', {
        operation: 'updateContactWithGroups',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: id,
        metadata: {
          hasGroupAssignments: !!data.groups,
          groupAssignmentsCount: data.groups?.length || 0,
          updateFields: Object.keys(data),
        },
      });

      // Input validation
      this.validateUpdateData(data);

      const existingContact = await this.repository.findOne({
        where: { id },
        relations: [
          'person',
          'emails',
          'phones',
          'addresses',
          'groupMemberships',
        ],
      });

      if (!existingContact) {
        this.logger.business('error', 'Contact not found for update', {
          operation: 'updateContactWithGroups',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: id,
        });
        throw new BadRequestException('Contact not found');
      }

      // Handle nested person update
      if (data.person) {
        const personData = Array.isArray(data.person)
          ? data.person[0]
          : data.person;
        if (existingContact.person) {
          Object.assign(existingContact.person, personData);
        } else {
          existingContact.person = await this.personRepository.create(
            personData as DeepPartial<Person>,
          );
        }
      }

      // Handle nested email updates
      if (data.emails) {
        await this.updateEmailsEfficiently(existingContact, data.emails);
      }

      // Handle nested phone updates
      if (data.phones) {
        await this.updatePhonesEfficiently(existingContact, data.phones);
      }

      // Handle nested address updates
      if (data.addresses) {
        await this.updateAddressesEfficiently(existingContact, data.addresses);
      }

      // Remove groups field from contact data since it's handled separately
      const {
        person: __person,
        emails: __emails,
        phones: __phones,
        addresses: __addresses,
        groups: __groups,
        ...contactData
      } = data;

      if (Object.keys(contactData).length > 0) {
        Object.assign(existingContact, contactData);
      }

      try {
        // Save the contact first (without group memberships to avoid constraint issues)
        const savedContact = await this.repository.save(existingContact);

        // Handle group membership updates after contact is saved
        if (data.groups !== undefined) {
          // Reload contact to get fresh group memberships
          const contactWithMemberships = await this.repository.findOne({
            where: { id: savedContact.id },
            relations: ['groupMemberships'],
          });

          await this.handleGroupMembershipsUpdate(
            contactWithMemberships,
            data.groups,
            request,
          );
        }

        this.logger.business(
          'log',
          'Contact with groups updated successfully',
          {
            operation: 'updateContactWithGroups',
            userId: request?.user?.id,
            contactId: request?.user?.contactId,
            resourceId: id,
            metadata: { contactId: savedContact.id },
          },
        );

        this.logger.endTracking(tracking, true);
        return await this.findOne(savedContact.id);
      } catch (error) {
        this.logger.error(error, {
          operation: 'updateContactWithGroups',
          userId: request?.user?.id,
          contactId: request?.user?.contactId,
          resourceId: id,
        });
        this.logger.endTracking(tracking, false);
        throw new BadRequestException(
          `Failed to update contact with groups: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(error, {
        operation: 'updateContactWithGroups',
        userId: request?.user?.id,
        contactId: request?.user?.contactId,
        resourceId: id,
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async createPerson(createPersonDto: CreatePersonDto): Promise<Contact> {
    //First check if email address exists
    const emailData = await this.emailRepository.find({
      where: [{ value: createPersonDto.email }],
    });
    if (emailData.length > 0) {
      throw new BadRequestException({
        message:
          'Email already exists. This email has already been registered.',
      });
    }

    const model = getContactModel(createPersonDto);

    // Set tenant from context
    const tenantId = this.tenantContext.requireTenant();
    Logger.log('tenantId');
    Logger.log(tenantId);
    model.tenant = { id: tenantId } as Tenant;

    await this.getGroupRequest(createPersonDto);
    const newPerson = await this.repository.save(model, { reload: true });
    if (hasValue(createPersonDto.residence)) {
      createPersonDto.residence.contactId = newPerson.id;
      await this.addressesService.create(createPersonDto.residence);
    }
    return newPerson;
  }

  async getGroupRequest(createPersonDto: CreatePersonDto): Promise<void> {
    try {
      const groupMembershipRequests: GroupMembershipRequest[] = [];
      if (createPersonDto.joinCell === 'Yes') {
        Logger.log('Attempt to add person to MC');
        const groupRequest = new GroupMembershipRequest();
        const details = {
          placeId: createPersonDto.residence.placeId,
          parentGroupId: createPersonDto.churchLocationId,
        };
        const closestGroup = await this.getClosestGroups(details);
        Logger.log(
          `Got closest group:${closestGroup.id}>>${
            closestGroup.name
          } ${JSON.stringify(closestGroup)}`,
        );
        if (hasValue(closestGroup)) {
          groupRequest.parentId = details.parentGroupId;
          groupRequest.groupId = closestGroup.groupId;
          groupRequest.distanceKm = Math.round(closestGroup.distance / 1000);
          groupMembershipRequests.push(groupRequest);
          await this.notifyLeader(closestGroup, createPersonDto);
        }
      }
    } catch (e) {
      console.log('Failed to attach to group');
    }
  }

  async getClosestGroups(
    data: GetClosestGroupDto,
  ): Promise<any | GetGroupResponseDto> {
    try {
      const { placeId, parentGroupId } = data;

      let place: GooglePlaceDto = null;
      if (placeId) {
        place = await this.googleService.getPlaceDetails(placeId);
      }

      const groupCategory = getRepository(GroupCategory)
        .createQueryBuilder('groupCategory')
        .where('groupCategory.name = :groupCategoryName', {
          groupCategoryName: groupCategories.MC,
        })
        .getOne();

      const groupsAtLocation = await getRepository(Group)
        .createQueryBuilder('group')
        .where('group.parentId = :churchLocationId', {
          churchLocationId: parentGroupId,
        })
        .andWhere('group.category = :groupCategory', {
          groupCategory: groupCategory,
        })
        .getMany();

      if (groupsAtLocation.length === 0) {
        Logger.warn("There are no groups in the person's vicinity");
        return [];
      }

      //Variable to store closest cell group
      let closestCellGroupid = groupsAtLocation[0].id;
      let closestCellGroupname = groupsAtLocation[0].name;
      let closestCellGroupMetadata = groupsAtLocation[0].metaData;
      //Initialise variable to store least distance
      let leastDistance = getPreciseDistance(
        { latitude: place?.latitude, longitude: place?.longitude },
        {
          latitude: groupsAtLocation[0]?.address?.latitude,
          longitude: groupsAtLocation[0]?.address?.longitude,
        },
        1,
      );

      //Calculate closest distance
      for (let i = 1; i < groupsAtLocation.length; i++) {
        const distanceToCellGroup = getPreciseDistance(
          { latitude: place.latitude, longitude: place.longitude },
          {
            latitude: groupsAtLocation[i]?.address?.latitude,
            longitude: groupsAtLocation[i]?.address?.longitude,
          },
          1,
        );
        if (distanceToCellGroup < leastDistance) {
          leastDistance = distanceToCellGroup;
          closestCellGroupid = groupsAtLocation[i].id;
          closestCellGroupname = groupsAtLocation[i].name;
          closestCellGroupMetadata = groupsAtLocation[i].metaData;
        }
      }
      return {
        groupId: closestCellGroupid,
        groupName: closestCellGroupname,
        groupMeta: closestCellGroupMetadata,
        distance: leastDistance,
      };
    } catch (e) {
      console.log(e);
      Logger.error('Failed to create member request', e);
      return [];
    }
  }

  async notifyLeader(closestGroup: any, personDto: CreatePersonDto) {
    try {
      if (!hasValue(closestGroup)) {
        Logger.log('Invalid group data');
      }
      const leader = await this.membershipRepository.findOne({
        where: { groupId: closestGroup.id, role: GroupRole.Leader },
        relations: { contact: { person: true, emails: true } },
      });
      if (leader) {
        Logger.log(
          `There are no leaders in  for this group:${closestGroup.id}`,
        );
      }
      //notify cell group leader of cell group with shortest distance to the person's residence
      const closestCellData = JSON.parse(closestGroup.groupMeta);
      const mailerData: IEmail = {
        to: `${closestCellData.email}`,
        subject: 'Join MC Request',
        html: `
          <h3>Hello ${closestCellData.leaders},</h3></br>
          <h4>I hope all is well on your end.<h4></br>
          <p>${personDto.firstName} ${personDto.lastName} who lives in ${personDto.residence.description},
          would like to join your Missional Community ${closestGroup.groupName}.</br>
          You can reach ${personDto.firstName} on ${personDto.phone} or ${personDto.email}.</p></br>
          <p>Cheers!</p>
          `,
      };
      await sendEmail(mailerData);
    } catch (e) {
      Logger.error('Failed to notify leader');
    }
  }

  async findOne(id: number): Promise<Contact> {
    const contact = await this.repository.findOne({
      where: { id },
      relations: [
        'person',
        'emails',
        'phones',
        'addresses',
        'identifications',
        'requests',
        'relationships',
        'groupMemberships',
        'groupMemberships.group',
      ],
    });

    if (contact?.groupMemberships) {
      contact.groupMemberships = contact.groupMemberships.filter(
        (membership) => membership.isActive !== false,
      );
    }

    return contact;
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    const emailRecord = await this.emailRepository.findOne({
      where: { value: email },
      relations: ['contact'],
    });
    return emailRecord?.contact;
  }

  async findByNameAndGroup(
    firstName: string,
    lastName: string,
    groupId: number,
  ): Promise<Contact | undefined> {
    const tenantId = this.tenantContext.requireTenant();
    const membership = await this.membershipRepository
      .createQueryBuilder('gm')
      .innerJoinAndSelect('gm.contact', 'contact')
      .innerJoin('contact.person', 'person')
      .innerJoin('contact.tenant', 'tenant')
      .where('gm.groupId = :groupId', { groupId })
      .andWhere('LOWER(person.firstName) = LOWER(:firstName)', { firstName })
      .andWhere('LOWER(person.lastName) = LOWER(:lastName)', { lastName })
      .andWhere('tenant.id = :tenantId', { tenantId })
      .getOne();
    return membership?.contact;
  }

  async findByName(username: string): Promise<Contact | undefined> {
    return await this.repository
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .leftJoinAndSelect('user.contact', 'contact')
      .leftJoinAndSelect('contact.person', 'person')
      .getOne();
  }

  async createCompany(data: CreateCompanyDto): Promise<Contact> {
    throw 'Not yet implemented';
  }

  private validateUpdateData(data: Partial<Contact>): void {
    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    // Validate emails
    if (data.emails) {
      if (!Array.isArray(data.emails)) {
        throw new BadRequestException('Emails must be an array');
      }
      data.emails.forEach((email, index) => {
        if (!email.value || typeof email.value !== 'string') {
          throw new BadRequestException(
            `Email at index ${index} must have a valid value`,
          );
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          throw new BadRequestException(
            `Email at index ${index} has invalid format`,
          );
        }
      });
    }

    // Validate phones
    if (data.phones) {
      if (!Array.isArray(data.phones)) {
        throw new BadRequestException('Phones must be an array');
      }
      data.phones.forEach((phone, index) => {
        if (!phone.value || typeof phone.value !== 'string') {
          throw new BadRequestException(
            `Phone at index ${index} must have a valid value`,
          );
        }
      });
    }

    // Validate addresses
    if (data.addresses) {
      if (!Array.isArray(data.addresses)) {
        throw new BadRequestException('Addresses must be an array');
      }
      data.addresses.forEach((address, index) => {
        if (!address.country || typeof address.country !== 'string') {
          throw new BadRequestException(
            `Address at index ${index} must have a country`,
          );
        }
        if (!address.district || typeof address.district !== 'string') {
          throw new BadRequestException(
            `Address at index ${index} must have a district`,
          );
        }
      });
    }
  }

  private async updateEmailsEfficiently(
    existingContact: Contact,
    newEmails: Partial<Email>[],
  ): Promise<void> {
    const existingEmails = existingContact.emails || [];
    const emailsToKeep: Email[] = [];
    const emailsToUpdate: Email[] = [];
    const emailsToCreate: Partial<Email>[] = [];

    // Process new emails
    newEmails.forEach((newEmail, index) => {
      if (newEmail.id && index < existingEmails.length) {
        // Update existing email
        const existingEmail = existingEmails.find((e) => e.id === newEmail.id);
        if (existingEmail) {
          Object.assign(existingEmail, newEmail);
          emailsToUpdate.push(existingEmail);
          emailsToKeep.push(existingEmail);
        }
      } else {
        // Create new email
        emailsToCreate.push({
          ...newEmail,
          contactId: existingContact.id,
        });
      }
    });

    // Remove emails that are no longer needed
    const emailsToRemove = existingEmails.filter(
      (email) => !emailsToKeep.some((kept) => kept.id === email.id),
    );

    if (emailsToRemove.length > 0) {
      await this.emailRepository.remove(emailsToRemove);
    }

    // Update existing emails
    if (emailsToUpdate.length > 0) {
      await this.emailRepository.save(emailsToUpdate);
    }

    // Create new emails
    if (emailsToCreate.length > 0) {
      const createdEmails = await this.emailRepository.save(
        emailsToCreate.map((emailData) =>
          this.emailRepository.create(emailData),
        ),
      );
      emailsToKeep.push(...createdEmails);
    }

    existingContact.emails = emailsToKeep;
  }

  private async updatePhonesEfficiently(
    existingContact: Contact,
    newPhones: Partial<Phone>[],
  ): Promise<void> {
    const existingPhones = existingContact.phones || [];
    const phonesToKeep: Phone[] = [];
    const phonesToUpdate: Phone[] = [];
    const phonesToCreate: Partial<Phone>[] = [];

    // Process new phones
    newPhones.forEach((newPhone, index) => {
      if (newPhone.id && index < existingPhones.length) {
        // Update existing phone
        const existingPhone = existingPhones.find((p) => p.id === newPhone.id);
        if (existingPhone) {
          Object.assign(existingPhone, newPhone);
          phonesToUpdate.push(existingPhone);
          phonesToKeep.push(existingPhone);
        }
      } else {
        // Create new phone
        phonesToCreate.push({
          ...newPhone,
          contactId: existingContact.id,
        });
      }
    });

    // Remove phones that are no longer needed
    const phonesToRemove = existingPhones.filter(
      (phone) => !phonesToKeep.some((kept) => kept.id === phone.id),
    );

    if (phonesToRemove.length > 0) {
      await this.phoneRepository.remove(phonesToRemove);
    }

    // Update existing phones
    if (phonesToUpdate.length > 0) {
      await this.phoneRepository.save(phonesToUpdate);
    }

    // Create new phones
    if (phonesToCreate.length > 0) {
      const createdPhones = await this.phoneRepository.save(
        phonesToCreate.map((phoneData) =>
          this.phoneRepository.create(phoneData),
        ),
      );
      phonesToKeep.push(...createdPhones);
    }

    existingContact.phones = phonesToKeep;
  }

  private async updateAddressesEfficiently(
    existingContact: Contact,
    newAddresses: Partial<Address>[],
  ): Promise<void> {
    const existingAddresses = existingContact.addresses || [];
    const addressesToKeep: Address[] = [];
    const addressesToUpdate: Address[] = [];
    const addressesToCreate: Partial<Address>[] = [];

    // Process new addresses
    newAddresses.forEach((newAddress, index) => {
      if (newAddress.id && index < existingAddresses.length) {
        // Update existing address
        const existingAddress = existingAddresses.find(
          (a) => a.id === newAddress.id,
        );
        if (existingAddress) {
          Object.assign(existingAddress, newAddress);
          addressesToUpdate.push(existingAddress);
          addressesToKeep.push(existingAddress);
        }
      } else {
        // Create new address
        addressesToCreate.push({
          ...newAddress,
          contactId: existingContact.id,
        });
      }
    });

    // Remove addresses that are no longer needed
    const addressesToRemove = existingAddresses.filter(
      (address) => !addressesToKeep.some((kept) => kept.id === address.id),
    );

    if (addressesToRemove.length > 0) {
      await this.addressRepository.remove(addressesToRemove);
    }

    // Update existing addresses
    if (addressesToUpdate.length > 0) {
      await this.addressRepository.save(addressesToUpdate);
    }

    // Create new addresses
    if (addressesToCreate.length > 0) {
      const createdAddresses = await this.addressRepository.save(
        addressesToCreate.map((addressData) =>
          this.addressRepository.create(addressData),
        ),
      );
      addressesToKeep.push(...createdAddresses);
    }

    existingContact.addresses = addressesToKeep;
  }

  /**
   * Get contact IDs for contacts that belong to groups the user can access
   */
  private async getContactsInUserAccessibleGroups(
    user: any,
  ): Promise<number[]> {
    try {
      // Get user's accessible groups (both manageable and viewable)
      const userGroupIds = await this.getUserAccessibleGroups(user);

      if (userGroupIds.length === 0) {
        return [];
      }

      // Get contacts that are active members of these groups
      const memberships = await this.membershipRepository.find({
        where: { groupId: In(userGroupIds), isActive: true },
        select: ['contactId'],
      });

      // Return unique contact IDs
      const contactIds = [...new Set(memberships.map((m) => m.contactId))];
      return contactIds;
    } catch (error) {
      Logger.error('Error getting contacts in user accessible groups:', error);
      return [];
    }
  }

  /**
   * Get groups that user can access (view members from)
   */
  private async getUserAccessibleGroups(user: any): Promise<number[]> {
    try {
      // Get user's leadership groups
      const memberships = await this.membershipRepository.find({
        where: {
          contactId: user.contactId,
          role: GroupRole.Leader,
          isActive: true,
        },
        select: ['groupId'],
      });

      const leadershipGroups = memberships.map((m) => m.groupId);

      // Expand to include all descendant groups using the tree service
      return await this.groupTreeService.getGroupAndAllChildren(
        leadershipGroups,
      );
    } catch (error) {
      Logger.error('Error getting user accessible groups:', error);
      return [];
    }
  }
}
