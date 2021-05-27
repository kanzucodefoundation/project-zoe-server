import Contact from '../entities/contact.entity';
import { CreatePersonDto } from '../dto/create-person.dto';
import { ContactCategory } from '../enums/contactCategory';
import Person from '../entities/person.entity';
import { createAvatar } from '../crm.helpers';
import { hasValue, isValidNumber } from '../../utils/validation';
import Phone from '../entities/phone.entity';
import { PhoneCategory } from '../enums/phoneCategory';
import Email from '../entities/email.entity';
import { EmailCategory } from '../enums/emailCategory';
import Address from '../entities/address.entity';
import { AddressCategory } from '../enums/addressCategory';
import GooglePlaceDto from '../../vendor/google-place.dto';
import GroupMembership from '../../groups/entities/groupMembership.entity';
import { GroupRole } from '../../groups/enums/groupRole';

export const getContactModel = (
  personDto: CreatePersonDto,
  place?: GooglePlaceDto,
): Contact => {
  const model = new Contact();
  model.category = ContactCategory.Person;
  model.person = new Person();
  model.person.firstName = personDto.firstName;
  model.person.middleName = personDto.middleName;
  model.person.lastName = personDto.lastName;
  model.person.civilStatus = personDto.civilStatus;
  model.person.salutation = null;
  model.person.dateOfBirth = personDto.dateOfBirth;
  model.person.avatar = createAvatar(personDto.email);
  model.person.gender = personDto.gender;
  model.person.placeOfWork = personDto.placeOfWork;
  model.person.ageGroup = personDto.ageGroup;

  model.phones = [];
  if (hasValue(personDto.phone)) {
    const p = new Phone();
    p.category = PhoneCategory.Mobile;
    p.isPrimary = true;
    p.value = personDto.phone;
    model.phones.push(p);
  }

  model.emails = [];
  if (hasValue(personDto.email)) {
    const e = new Email();
    e.category = EmailCategory.Personal;
    e.isPrimary = true;
    e.value = personDto.email;
    model.emails.push(e);
  }

  model.addresses = [];
  if (place) {
    const address = new Address();
    address.category = AddressCategory.Home;
    address.isPrimary = true;
    address.freeForm = place.name;
    address.placeId = place.placeId;
    address.longitude = place.longitude;
    address.latitude = place.latitude;
    address.country = place.country;
    address.district = place.district;
    model.addresses.push(address);
  }
  model.groupMemberships = [];
  if (isValidNumber(personDto.churchLocationId)) {
    const membership = new GroupMembership();
    membership.groupId = personDto.churchLocationId;
    membership.role = GroupRole.Member;
    model.groupMemberships.push(membership);
  }
  if (isValidNumber(personDto.cellGroupId)) {
    const membership = new GroupMembership();
    membership.groupId = personDto.cellGroupId;
    membership.role = GroupRole.Member;
    model.groupMemberships.push(membership);
  }
  return model;
};
