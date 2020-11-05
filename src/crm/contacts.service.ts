import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
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
import { User } from 'src/users/user.entity';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  private static toListDto(it: Contact): ContactListDto {
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
      address.freeForm = personDto.residence;
      addresses.push(address);
    }

    const groupMemberships: GroupMembership[] = [];
    if (isValidNumber(personDto.churchLocationId)) {
      const membership = new GroupMembership();
      membership.groupId = personDto.churchLocationId;
      membership.role = GroupRole.Member;
      groupMemberships.push(membership);
    }

    if (isValidNumber(personDto.cellGroupId)) {
      const membership = new GroupMembership();
      membership.groupId = personDto.cellGroupId;
      membership.role = GroupRole.Member;
      groupMemberships.push(membership);
    }

    const model = new Contact();

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
    contact.identifications = [];
    contact.occasions = [];
    return contact;
  }

  async findOne(id: number): Promise<Contact> {
    return await this.repository.findOne(id, {
      relations: ['person', 'emails', 'phones', 'addresses', 'identifications', 'requests', 'relationships'],
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
