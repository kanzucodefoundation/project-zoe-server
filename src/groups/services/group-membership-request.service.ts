import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { Repository, TreeRepository } from 'typeorm';
import GroupMembershipRequestSearchDto from '../dto/membershipRequest/search-request.dto';
import GroupMembershipRequest from '../entities/groupMembershipRequest.entity';
import { hasValue } from 'src/utils/validation';
import GroupMembershipRequestDto from '../dto/membershipRequest/group-membership-request.dto';
import { NewRequestDto } from '../dto/membershipRequest/new-request.dto';
import { getPersonFullName } from 'src/crm/crm.helpers';
import { ContactsService } from 'src/crm/contacts.service';
import Contact from 'src/crm/entities/contact.entity';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import Email from 'src/crm/entities/email.entity';
import GroupMembership from '../entities/groupMembership.entity';
import Group from '../entities/group.entity';

@Injectable()
export class GroupMembershipRequestService {
  constructor(
    @InjectRepository(GroupMembershipRequest)
    private readonly repository: Repository<GroupMembershipRequest>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(GroupMembership)
    private readonly membershipRepository: Repository<GroupMembership>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly contactService: ContactsService,
  ) {}

  async findAll(
    req: GroupMembershipRequestSearchDto,
  ): Promise<GroupMembershipRequestDto[]> {
    const filter: FindConditions<GroupMembershipRequest> = {};

    if (hasValue(req.contactId)) filter.contactId = req.contactId;
    if (hasValue(req.parentId)) filter.parentId = req.parentId;
    if (hasValue(req.groupId)) filter.groupId = req.groupId;

    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'group'],
      skip: req.skip,
      take: req.limit,
      where: filter,
    });
    return data.map(this.toDto);
  }

  toDto(data: GroupMembershipRequest): GroupMembershipRequestDto {
    const { group, contact, ...rest } = data;
    return {
      ...rest,
      group: {
        id: group.id,
        name: group.name,
        parent: group.parent
          ? { id: group.parent.id, name: group.parent.name }
          : null,
      },
      contact: {
        id: contact.id,
        fullName: getPersonFullName(contact.person),
        avatar: contact.person.avatar,
      },
    };
  }

  async create(data: NewRequestDto): Promise<GroupMembershipRequestDto | any> {
    // console.log('All the data', data);
    const user = await this.contactRepository.findOne(data.contactId, {
      relations: ['person'],
    });

    //Checking if a member is already attached to an MC
    const mcAttachedTo = await this.groupRepository.findOne({
      where: { id: data.churchLocation },
    });

    const categoryID = mcAttachedTo.categoryId;
    if (categoryID.toLocaleLowerCase() === 'mc') {
      throw new HttpException('User is already registered to an MC', 400);
    }

    const isPendingRequest = await this.repository.count({
      where: { contactId: data.contactId },
    });

    if (isPendingRequest > 0) {
      throw new HttpException('User already has a pending request', 400);
    }

    const groupDetails = {
      placeId: data.residencePlaceId,
      parentGroupId: data.churchLocation,
    };

    const info = await this.contactService.getClosestGroups(groupDetails);

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        contactId: data.contactId,
        parentId: data.churchLocation,
        groupId: info.groupId,
        distanceKm: Math.round(info.distance / 1000),
      })
      .execute();

    const closestCellData = JSON.parse(info.groupMeta);
    console.log(closestCellData);
    const mailerData: IEmail = {
      to: `${closestCellData.email}`,
      subject: 'Join MC Request',
      html: `
            <h3>Hello ${closestCellData.leaders},</h3></br>
            <h4>I hope all is well on your end.<h4></br>
            <p>${user.person.firstName} ${user.person.lastName} who lives in ${data.residenceDescription},
            would like to join your Missional Community ${info.groupName}.</br>
            You can reach ${user.person.firstName} on ${data.phone} or ${data.email}.</p></br>
            <p>Cheers!</p>
            `,
    };
    await sendEmail(mailerData);

    return (
      await this.repository.find({
        where: { contactId: data.contactId },
        relations: ['contact', 'contact.person', 'group'],
      })
    ).map(this.toDto);
  }

  async update(): Promise<any> {
    return 'Not Yet Implemented';
  }

  async findOne(id: number): Promise<GroupMembershipRequestDto> {
    return this.toDto(
      await this.repository.findOne(id, {
        relations: ['contact', 'contact.person', 'group'],
      }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
