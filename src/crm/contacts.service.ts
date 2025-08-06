import {
  BadRequestException,
  Injectable,
  Logger,
  Inject,
} from "@nestjs/common";
import { intersection } from "lodash";
import {
  getRepository,
  ILike,
  In,
  Like,
  Repository,
  Connection,
  TreeRepository,
} from "typeorm";
import Contact from "./entities/contact.entity";
import { CreatePersonDto } from "./dto/create-person.dto";
import {
  getCellGroup,
  getEmail,
  getLocation,
  getPersonFullName,
  getPhone,
} from "./crm.helpers";
import { ContactSearchDto } from "./dto/contact-search.dto";
import Phone from "./entities/phone.entity";
import Email from "./entities/email.entity";
import Person from "./entities/person.entity";
import Company from "./entities/company.entity";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { hasNoValue, hasValue } from "src/utils/validation";
import Address from "./entities/address.entity";
import GroupMembership from "../groups/entities/groupMembership.entity";
import { GroupRole } from "../groups/enums/groupRole";
import ContactListDto from "./dto/contact-list.dto";
import Group from "../groups/entities/group.entity";
import { GoogleService } from "src/vendor/google.service";
import GooglePlaceDto from "src/vendor/google-place.dto";
import { getPreciseDistance } from "geolib";
import GroupMembershipRequest from "src/groups/entities/groupMembershipRequest.entity";
import { IEmail, sendEmail } from "src/utils/mailer";
import {
  GetClosestGroupDto,
  GetGroupResponseDto,
} from "src/groups/dto/membershipRequest/new-request.dto";
import { PrismaService } from "../shared/prisma.service";
import { getContactModel } from "./utils/creationUtils";
import { GroupFinderService } from "./group-finder/group-finder.service";
import { AddressesService } from "./addresses.service";
import GroupCategory from "src/groups/entities/groupCategory.entity";
import { groupCategories } from "src/groups/groups.constants";

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

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private googleService: GoogleService,
    private prisma: PrismaService,
    private groupFinderService: GroupFinderService,
    private addressesService: AddressesService,
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
  }

  async findAll(req: ContactSearchDto): Promise<ContactListDto[]> {
    try {
      let hasFilter = false;
      //This will hold the query id list
      let idList: number[] = [];
      const groups = [
        ...(req.cellGroups || []),
        ...(req.churchLocations || []),
      ];
      if (hasValue(groups)) {
        Logger.log(`searching by groups: ${groups.join(",")}`);
        hasFilter = true;
        const resp = await this.membershipRepository.find({
          select: ["contactId"],
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
        hasFilter = true;
        const resp = await this.personRepository.find({
          select: ["contactId"],
          where: [
            {
              firstName: ILike(`%${req.query.trim()}%`),
            },
            {
              lastName: ILike(`%${req.query.trim()}%`),
            },
            {
              middleName: ILike(`%${req.query.trim()}%`),
            },
          ],
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

      if (hasValue(req.phone)) {
        hasFilter = true;
        const resp = await this.phoneRepository.find({
          select: ["contactId"],
          where: { value: Like(`%${req.phone}%`) },
        });
        console.log("resp", resp);
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
          select: ["contactId"],
          where: { value: ILike(`%${req.email.trim().toLowerCase()}%`) },
        });
        Logger.log(`searching by email: ${resp.join(",")}`);
        if (hasValue(idList)) {
          idList = intersection(
            idList,
            resp.map((it) => it.contactId),
          );
        } else {
          idList.push(...resp.map((it) => it.contactId));
        }
      }

      console.log("IdList", idList);
      if (hasFilter && hasNoValue(idList)) {
        return [];
      }
      const data = await this.repository.find({
        relations: [
          "person",
          "emails",
          "phones",
          "groupMemberships",
          "groupMemberships.group",
          "groupMemberships.group.category",
        ],
        skip: req.skip,
        take: req.limit,
        where: hasValue(idList) ? { id: In(idList) } : undefined,
      });

      return data.map((it) => {
        return ContactsService.toListDto(it);
      });
    } catch (e) {
      Logger.error(e.message);
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
      cellGroup: hasValue(cellGroup)
        ? { id: cellGroup.id, name: cellGroup.name }
        : null,
      location: hasValue(location)
        ? { id: location.id, name: location.name }
        : null,
    };
  }

  async create(data: Contact): Promise<Contact> {
    return await this.repository.save(data);
  }

  async update(data: Contact): Promise<Contact> {
    return await this.repository.save(data);
  }

  async createPerson(createPersonDto: CreatePersonDto): Promise<Contact> {
    //First check if email address exists
    const emailData = await this.emailRepository.find({
      where: [{ value: createPersonDto.email }],
    });
    if (emailData.length > 0) {
      throw new BadRequestException({
        message:
          "Email already exists. This email has already been registered.",
      });
    }

    const model = getContactModel(createPersonDto);
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
      if (createPersonDto.joinCell === "Yes") {
        Logger.log(`Attempt to add person to MC`);
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
      console.log("Failed to attach to group");
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
        .createQueryBuilder("groupCategory")
        .where("groupCategory.name = :groupCategoryName", {
          groupCategoryName: groupCategories.MC,
        })
        .getOne();

      const groupsAtLocation = await getRepository(Group)
        .createQueryBuilder("group")
        .where("group.parentId = :churchLocationId", {
          churchLocationId: parentGroupId,
        })
        .andWhere("group.category = :groupCategory", {
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
      Logger.error("Failed to create member request", e);
      return [];
    }
  }

  async notifyLeader(closestGroup: any, personDto: CreatePersonDto) {
    try {
      if (!hasValue(closestGroup)) {
        Logger.log(`Invalid group data`);
      }
      const leader = await this.prisma.group_membership.findFirst({
        where: { groupId: closestGroup.id, role: GroupRole.Leader },
        include: {
          contact: {
            include: {
              person: { select: { firstName: true } },
              email: true,
            },
          },
        },
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
        subject: "Join MC Request",
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
      Logger.error("Failed to notify leader");
    }
  }

  async findOne(id: number): Promise<Contact> {
    return await this.repository.findOne({
      where: { id },
      relations: [
        "person",
        "emails",
        "phones",
        "addresses",
        "identifications",
        "requests",
        "relationships",
        "groupMemberships",
        "groupMemberships.group",
      ],
    });
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByName(username: string): Promise<Contact | undefined> {
    return await this.repository
      .createQueryBuilder("user")
      .where("user.username = :username", { username })
      .leftJoinAndSelect("user.contact", "contact")
      .leftJoinAndSelect("contact.person", "person")
      .getOne();
  }

  async createCompany(data: CreateCompanyDto): Promise<Contact> {
    throw "Not yet implemented";
  }
}
