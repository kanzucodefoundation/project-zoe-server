import { Injectable, Inject } from '@nestjs/common';
import { Connection, Repository, ILike, In } from 'typeorm';
import Contact from '../crm/entities/contact.entity';
import Group from '../groups/entities/group.entity';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';

@Injectable()
export class SearchService {
  private readonly contactRepository: Repository<Contact>;
  private readonly groupRepository: Repository<Group>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private groupPermissionsService: GroupPermissionsService,
  ) {
    this.contactRepository = connection.getRepository(Contact);
    this.groupRepository = connection.getRepository(Group);
  }

  async search(
    query: string,
    type: string,
    limit: number,
    user: any,
  ): Promise<any> {
    const results = {
      contacts: [],
      groups: [],
      total: 0,
    };

    if (!query || query.trim().length === 0) {
      return results;
    }

    const searchQuery = `%${query.trim()}%`;

    // Search contacts
    if (type === 'all' || type === 'contacts') {
      const contacts = await this.searchContacts(searchQuery, limit, user);
      results.contacts = contacts;
      results.total += contacts.length;
    }

    // Search groups
    if (type === 'all' || type === 'groups') {
      const groups = await this.searchGroups(searchQuery, limit, user);
      results.groups = groups;
      results.total += groups.length;
    }

    return results;
  }

  private async searchContacts(
    searchQuery: string,
    limit: number,
    user: any,
  ): Promise<any[]> {
    try {
      // Get user's accessible group IDs for contact filtering
      const userGroupIds =
        await this.groupPermissionsService.getUserGroupIds(user);

      const queryBuilder = this.contactRepository
        .createQueryBuilder('contact')
        .leftJoinAndSelect('contact.person', 'person')
        .leftJoinAndSelect('contact.emails', 'emails')
        .leftJoinAndSelect('contact.phones', 'phones')
        .where('person.firstName ILIKE :query', { query: searchQuery })
        .orWhere('person.lastName ILIKE :query', { query: searchQuery })
        .orWhere('emails.value ILIKE :query', { query: searchQuery });

      if (userGroupIds.length > 0) {
        queryBuilder
          .leftJoin('contact.groupMemberships', 'membership')
          .andWhere('membership.groupId IN (:...groupIds)', {
            groupIds: userGroupIds,
          });
      }

      const contacts = await queryBuilder.take(limit).getMany();

      return contacts.map((contact) => ({
        id: contact.id,
        type: 'contact',
        fullName: `${contact.person?.firstName || ''} ${
          contact.person?.lastName || ''
        }`.trim(),
        email: contact.emails?.[0]?.value || null,
        phone: contact.phones?.[0]?.value || null,
        category: contact.category,
      }));
    } catch (error) {
      console.error('Error searching contacts:', error);
      return [];
    }
  }

  private async searchGroups(
    searchQuery: string,
    limit: number,
    user: any,
  ): Promise<any[]> {
    try {
      // Get user's accessible group IDs
      const userGroupIds =
        await this.groupPermissionsService.getUserGroupIds(user);

      if (userGroupIds.length === 0) {
        return [];
      }

      const groups = await this.groupRepository.find({
        where: {
          id: In(userGroupIds),
          name: ILike(searchQuery),
        },
        relations: ['category'],
        take: limit,
      });

      return groups.map((group) => ({
        id: group.id,
        type: 'group',
        name: group.name,
        category: group.category?.name || null,
        memberCount: group.members?.length || 0,
        privacy: group.privacy,
      }));
    } catch (error) {
      console.error('Error searching groups:', error);
      return [];
    }
  }
}
