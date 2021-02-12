import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getRepository, In, Like, Repository } from 'typeorm';
import Contact from './entities/contact.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { createAvatar, getCellGroup, getEmail, getLocation, getPersonFullName, getPhone } from './crm.helpers';
import { ContactSearchDto } from './dto/contact-search.dto';
import { ContactCategory } from './enums/contactCategory';
import Phone from './entities/phone.entity';
import Email from './entities/email.entity';
import Person from './entities/person.entity';
import Company from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { hasNoValue, hasValue, isValidNumber } from '../utils/basicHelpers';
import { PhoneCategory } from './enums/phoneCategory';
import { EmailCategory } from './enums/emailCategory';
import Address from './entities/address.entity';
import { AddressCategory } from './enums/addressCategory';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { GroupRole } from '../groups/enums/groupRole';
import ContactListDto from './dto/contact-list.dto';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import Group from '../groups/entities/group.entity';
import { GroupPrivacy } from '../groups/enums/groupPrivacy';
import { GoogleService } from 'src/vendor/google.service';
import GooglePlaceDto from 'src/vendor/google-place.dto';
import { getPreciseDistance } from 'geolib';
import GroupMembershipRequest from 'src/groups/entities/groupMembershipRequest.entity';
import { TransformOperationExecutor } from 'class-transformer/TransformOperationExecutor';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import CreateRequestDto from './dto/create-request.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repository: Repository<Contact>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Phone)
    private readonly phoneRepository: Repository<Phone>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(GroupMembership)
    private readonly membershipRepository: Repository<GroupMembership>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMembershipRequest)
    private readonly gmRequestRepository: Repository<GroupMembershipRequest>,
    private googleService: GoogleService,
  ) {
  }

  async findAll(req: ContactSearchDto): Promise<ContactListDto[]> {
    try {

      let hasFilter = false;
      //This will hold the query id list
      const idList: number[] = [];

      const groups = [...req.cellGroups || [], ...req.churchLocations || []];
      if (hasValue(groups)) {
        hasFilter = true;
        const resp = await this.membershipRepository
          .find({
            select: ['contactId'],
            where: { groupId: In(groups) },
          });
        idList.push(...resp.map(it => it.contactId));
      }

      if (hasValue(req.ageGroups)) {
        hasFilter = true;
        const resp = await this.personRepository
          .find({
            select: ['contactId'],
            where: { ageGroup: In(req.ageGroups) },
          });
        idList.push(...resp.map(it => it.contactId));
      }

      if (hasValue(req.query)) {
        hasFilter = true;
        const resp = await this.personRepository
          .find({
            select: ['contactId'],
            where: [
              {
                firstName: Like(`%${req.query.trim()}%`),
              },
              {
                lastName: Like(`%${req.query.trim()}%`),
              },
              {
                middleName: Like(`%${req.query.trim()}%`),
              },
            ],
          });
        idList.push(...resp.map(it => it.contactId));
      }

      if (hasValue(req.phone)) {
        hasFilter = true;
        const resp = await this.phoneRepository
          .find({
            select: ['contactId'],
            where: { value: Like(`%${req.phone}%`) },
          });
        idList.push(...resp.map(it => it.contactId));
      }

      if (hasValue(req.email)) {
        hasFilter = true;
        const resp = await this.emailRepository
          .find({
            select: ['contactId'],
            where: { value: Like(`%${req.email.trim().toLowerCase()}%`) },
          });
        idList.push(...resp.map(it => it.contactId));
      }

      console.log('IdList', idList);
      if (hasFilter && hasNoValue(idList)) {
        return [];
      }
      const findOpts: FindConditions<Contact> = {};
      if (hasValue(idList)) {
        findOpts.id = In(idList);
      }
      const data = await this.repository.find({
        relations: ['person', 'emails', 'phones', 'groupMemberships', 'groupMemberships.group'],
        skip: req.skip,
        take: req.limit,
        where: findOpts,
      });
      return data.map(it => {
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
      cellGroup: hasValue(cellGroup) ? { id: cellGroup.id, name: cellGroup.name } : null,
      location: hasValue(location) ? { id: location.id, name: location.name } : null,
    };
  }

  async create(data: Contact): Promise<Contact> {
    return await this.repository.save(data);
  }

  async update(data: Contact): Promise<Contact> {
    return await this.repository.save(data);
  }

  async createPerson(personDto: CreatePersonDto): Promise<Contact> {
    /*
    * TODO We can't save the contact at once because of a bug in type-orm
    *  https://github.com/typeorm/typeorm/issues/4090
    * */
    const person = new Person();
    person.firstName = personDto.firstName;
    person.middleName = personDto.middleName;
    person.lastName = personDto.lastName;
    person.civilStatus = personDto.civilStatus;
    person.salutation = null;
    person.dateOfBirth = personDto.dateOfBirth;
    person.avatar = createAvatar(personDto.email);
    person.gender = personDto.gender;
    person.placeOfWork = personDto.placeOfWork;
    person.ageGroup = personDto.ageGroup;

    const phones: Phone[] = [];
    if (hasValue(personDto.phone)) {
      const p = new Phone();
      p.category = PhoneCategory.Mobile;
      p.isPrimary = true;
      p.value = personDto.phone;
      phones.push(p);
    }

    const emails: Email[] = [];
    if (hasValue(personDto.email)) {
      const e = new Email();
      e.category = EmailCategory.Personal;
      e.isPrimary = true;
      e.value = personDto.email;
      emails.push(e);
    }

    const addresses: Address[] = [];
    if (hasValue(personDto.residence)) {
      const address = new Address();
      address.category = AddressCategory.Home;
      address.isPrimary = true;
      address.country = 'Uganda';
      address.district = 'Kampala';
      address.county = 'Kawempe';
      address.freeForm = personDto.residence.description;
      address.placeId = personDto.residence.place_id;
      //Make a call to the Google API to get coordinates
      let place: GooglePlaceDto = null;
      if (address.placeId) {
        place = await this.googleService.getPlaceDetails(address.placeId);
      }
      address.longitude = place.longitude;
      address.latitude = place.latitude;
      //uncomment this when fixed :D 
      //address.geoCoordinates = `ST_GeomFromText('POINT(${place.longitude} ${place.latitude})')`;
      addresses.push(address);
    }

    const groupMemberships: GroupMembership[] = [];
    if (isValidNumber(personDto.churchLocationId)) {
      const membership = new GroupMembership();
      membership.groupId = personDto.churchLocationId;
      membership.role = GroupRole.Member;
      groupMemberships.push(membership);
    }
    let groupMembershipRequests: GroupMembershipRequest[] = [];
    if (personDto.inCell==='Yes'){
      if (isValidNumber(personDto.cellGroupId)) {
        const membership = new GroupMembership();
        membership.groupId = personDto.cellGroupId;
        membership.role = GroupRole.Member;
        groupMemberships.push(membership);
      } else if (typeof personDto.cellGroupId === 'string') {
        const group = new Group();
        group.name = personDto.cellGroupId;
        group.parentId = personDto.churchLocationId;
        group.privacy = GroupPrivacy.Public;
        group.categoryId = 'MC';
        group.details = '--pending--';
        await this.groupRepository.save(group);
        const membership = new GroupMembership();
        membership.groupId = group.id;
        membership.role = GroupRole.Member;
        groupMemberships.push(membership);
      }
    } else {    
      
      if (personDto.joinCell === 'Yes') {

        const request: CreateRequestDto = {
          firstName: personDto.firstName,
          lastName: personDto.lastName,
          email: personDto.email,
          phone: personDto.phone,
          churchLocation: personDto.churchLocationId,
          residencePlaceId: personDto.residence.place_id,
          residenceDescription: personDto.residence.description,
        }
        
        groupMembershipRequests = await this.createRequest(request);    
      }
    }
        
    const model = new Contact();
    model.category = ContactCategory.Person;
    const contact = await this.repository.save(model);
    const contactRef = Contact.ref(contact.id);
    contact.person = await this.personRepository.save({ ...person, contact: contactRef });
    contact.phones = await this.phoneRepository.save(phones.map(it => ({ ...it, contact: contactRef })));
    contact.emails = await this.emailRepository.save(emails.map(it => ({ ...it, contact: contactRef })));
    contact.addresses = await this.addressRepository.save(addresses.map(it => ({ ...it, contact: contactRef })));
    contact.groupMemberships = await this.membershipRepository.save(groupMemberships.map(it => ({
      ...it,
      contact: contactRef,
    })));
    contact.groupMembershipRequests = await this.gmRequestRepository.save(groupMembershipRequests.map(it=> ({
      ...it,
      contact: contactRef,
    })));
    contact.identifications = [];
    contact.occasions = [];
    return await this.findOne(contact.id);
  }


  async createRequest (data: CreateRequestDto) {
    const groupMembershipRequests: GroupMembershipRequest[] = [];
    const groupRequest = new GroupMembershipRequest();

    let place: GooglePlaceDto = null;
    if (data.residencePlaceId) {
      place = await this.googleService.getPlaceDetails(data.residencePlaceId);
    }

    //Find all cell groups under user's church location
    const locationCellGroups = await getRepository(Group)
      .createQueryBuilder("group")
      .where ("group.parentId = :churchLocationId", {churchLocationId:data.churchLocation})
      .getMany();

    //Variable to store closest cell group
    var closestCellGroupid = locationCellGroups[0].id
    var closestCellGroupname = locationCellGroups[0].name
    var closestCellGroupMetadata = locationCellGroups[0].metaData
    //Initialise variable to store least distance 
    var leastDistance = getPreciseDistance(
      { latitude:place.latitude, longitude:place.longitude },
      { latitude:locationCellGroups[0].latitude, longitude:locationCellGroups[0].longitude },
      1
    );

    //Calculate closest distance
    for (var i = 1; i < locationCellGroups.length; i++) {
      var distanceToCellGroup = getPreciseDistance(
        { latitude:place.latitude, longitude:place.longitude },
        { latitude:locationCellGroups[i].latitude, longitude:locationCellGroups[i].longitude },1);
      if (distanceToCellGroup < leastDistance) { 
        leastDistance = distanceToCellGroup
        closestCellGroupid = locationCellGroups[i].id
        closestCellGroupname = locationCellGroups[i].name
        closestCellGroupMetadata = locationCellGroups[i].metaData
      } 
    }  

    //call create to add to database
    groupRequest.parentId = data.churchLocation;
    groupRequest.groupId = closestCellGroupid; 
    groupRequest.distanceKm = (leastDistance/1000);
    groupMembershipRequests.push(groupRequest);

    //notify cell group leader of cell group with shortest distance to the person's residence
    var closestCellData = JSON.parse(closestCellGroupMetadata)

    const mailerData:IEmail = {
      to: `${closestCellData.email}`,
      subject: "Join MC Request",
      html: 
      `
      <h3>Hello ${closestCellData.leaders},</h3></br>
      <h4>I hope all is well on your end.<h4></br>
      <p>${data.firstName} ${data.lastName} who lives in ${data.residenceDescription},
      would like to join your Missional Community ${closestCellGroupname}.</br>
      You can reach ${data.firstName} on ${data.phone} or ${data.email}.</p></br>
      <p>Cheers!</p>
      `
    }
    await sendEmail(mailerData); 

    return groupMembershipRequests;

  }

  async findOne(id: number): Promise<Contact> {
    return await this.repository.findOne(id, {
      relations: [
        'person', 'emails',
        'phones', 'addresses',
        'identifications', 'requests',
        'relationships', 'groupMemberships', 'groupMemberships.group'],
    });
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByName(username: string): Promise<Contact | undefined> {
    return await this.repository.findOne({ where: { username }, relations: ['contact.person'] });
  }

  async createCompany(data: CreateCompanyDto): Promise<Contact> {
    throw 'Not yet implemented';
  }
}
