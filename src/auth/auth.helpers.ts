import { User } from '../users/entities/user.entity';
import { UserDto } from './dto/user.dto';
import { getPersonFullName } from '../crm/crm.helpers';

export const cleanUpUser = (user: User) => {
  delete user['password'];
};

export const createUserDto = (user: User): UserDto => {
  const permissions = [];
  user.userRoles.forEach((it) => permissions.concat(it.roles.permissions));
  return {
    contactId: user.contact.id,
    email: user.username,
    username: user.username,
    fullName: getPersonFullName(user.contact.person),
    id: user.id,
    roles: user.userRoles.map((it) => it.roles.role),
    permissions,
    isActive: user.isActive,
  };
};
