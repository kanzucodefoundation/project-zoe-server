import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Connection,
  getRepository,
  In,
  Repository,
  TreeRepository,
} from 'typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import GroupMembership from '../entities/groupMembership.entity';
import GroupMembershipDto from '../dto/membership/group-membership.dto';
import { getPersonFullName } from '../../crm/crm.helpers';
import GroupMembershipSearchDto from '../dto/membership/group-membership-search.dto';
import ClientFriendlyException from '../../shared/exceptions/client-friendly.exception';
import UpdateGroupMembershipDto from '../dto/membership/update-group-membership.dto';
import BatchGroupMembershipDto from '../dto/membership/batch-group-membership.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { hasNoValue, hasValue } from '../../utils/validation';
import Group from '../entities/group.entity';
import { groupConstants } from '../../seed/data/groups';
import Contact from 'src/crm/entities/contact.entity';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import Email from 'src/crm/entities/email.entity';
import GroupMembershipRequest from '../entities/groupMembershipRequest.entity';

@Injectable()
export class GroupsMembershipService {
  constructor(
    @InjectRepository(GroupMembership)
    private readonly repository: Repository<GroupMembership>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(Group)
    private readonly groupTreeRepository: TreeRepository<Group>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
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
      throw new ClientFriendlyException('Please groupID or contactId');
    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'group', 'group.category'],
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
    let personId;
    members.forEach((contactId) => {
      personId = contactId;
      toInsert.push({ groupId, contactId, role });
    });
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(GroupMembership)
      .values(toInsert)
      .execute();
    //Send notifications to member
    this.sendMailToMember(personId, groupId);
    return members.length;
  }

  //Send an email
  async sendMailToMember(personId: number, groupId: number): Promise<void> {
    try {
      const user = await this.contactRepository.findOne(personId, {
        relations: ['person'],
      });

      //Find all from email repository given contactId
      const mailAddress = await this.emailRepository.findOne({
        where: [{ contactId: personId }],
      });
      const memberEmail = mailAddress.value;

      //finding MC attached to
      const groupsAtLocation = await getRepository(Group)
        .createQueryBuilder('group')
        .where('group.id = :groupId', {
          groupId: groupId,
        })
        .getMany();

      //Logging details
      console.log(
        groupsAtLocation[0].name,
        'located at ',
        groupsAtLocation[0].address.name,
      );

      const mailerData: IEmail = {
        to: `${memberEmail}`,
        subject: 'Approval of your Request to join an MC',
        html: `
        <h3>Hello ${user.person.firstName} ${user.person.lastName},</h3></br>
        <h4>Your request to join an MC has been approved<h4></br>
        <p> You have been attached to ${groupsAtLocation[0].name} located at ${groupsAtLocation[0].address.name}

        <p>Cheers!</p>
        `,
      };
      await sendEmail(mailerData);
      Logger.log('Email sent successfully.');
    } catch (error) {
      Logger.log(error);
    }
  }

  async findOne(id: number): Promise<GroupMembershipDto> {
    const data = await this.repository.findOne(id, {
      relations: ['group', 'contact', 'contact.person'],
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
      .where('id = :id', { id: dto.id })
      .execute();
    Logger.log(`Updated data ${update.affected} ${JSON.stringify(update.raw)}`);
    return await this.findOne(dto.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
