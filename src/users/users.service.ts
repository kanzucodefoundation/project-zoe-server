import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import Email from 'src/crm/entities/email.entity';
import { RegisterUserDto } from '../auth/dto/register-user.dto';
import SearchDto from '../shared/dto/search.dto';
import { ContactsService } from '../crm/contacts.service';
import Contact from '../crm/entities/contact.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto } from './dto/user-list.dto';
import { getPersonFullName } from '../crm/crm.helpers';
import * as bcrypt from 'bcrypt';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserResponseDto } from './dto/create-user-response.dto';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import { JwtService } from '@nestjs/jwt';
import { UserDto } from 'src/auth/dto/user.dto';
import { LoginResponseDto } from 'src/auth/dto/login-response.dto';
import { hasValue, isArray } from '../utils/validation';
import Roles from './entities/roles.entity';
import UserRoles from './entities/userRoles.entity';
import { differenceBy, isEqual } from 'lodash';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    private readonly jwtService: JwtService,
    private readonly contactsService: ContactsService,
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
    @InjectRepository(UserRoles)
    private readonly userRolesRepository: Repository<UserRoles>,
  ) {}

  async findAll(req: SearchDto): Promise<UserListDto[]> {
    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'userRoles', 'userRoles.roles'],
      skip: req.skip,
      take: req.limit,
    });

    return data.map(this.toListModel);
  }

  toListModel(user: User): UserListDto {
    const fullName = getPersonFullName(user.contact.person);
    return {
      avatar: user.contact.person.avatar,
      contact: {
        id: user.contactId,
        name: fullName,
      },
      id: user.id,
      roles: user.userRoles.map((it) =>
        it.roles.isActive ? it.roles.role : `${it.roles.role}: is disabled`,
      ),
      isActive: user.isActive,
      username: user.username,
      contactId: user.contactId,
      fullName,
    };
  }

  async generateToken(user: UserDto): Promise<LoginResponseDto> {
    const payload = { ...user, sub: user.id };
    const token = await this.jwtService.signAsync(payload);
    return { token, user };
  }

  async create(data: User): Promise<User> {
    data.hashPassword();

    return await this.repository.save(data);
  }

  async createUser(data: CreateUserDto): Promise<UserListDto> {
    if (!(await this.contactsService.findOne(data.contactId))) {
      throw new HttpException('Visitor Not Found', 404);
    }
    const email = await this.emailRepository.findOne({
      where: { contactId: data.contactId },
    });
    const toSave = new User();
    toSave.id = data.contactId;
    toSave.username = email.value;
    toSave.contactId = data.contactId;
    toSave.password = data.password;
    toSave.isActive = data.isActive;
    toSave.hashPassword();

    const saveUser = await this.create(toSave);

    if (!saveUser) {
      this.remove(saveUser.id);
      throw new HttpException('User Not Created', 400);
    } else {
      //TODO @Herbert Add code to save the user roles using the saveUser.id ID returned

      this.saveUserRoles(saveUser.contactId, data.roles);
    }

    const user = await this.findOne(saveUser.id);

    if (!user) {
      this.remove(user.id);

      throw new HttpException('Failed To Create User', 400);
    }

    const token = (
      await this.generateToken({
        id: user.id,
        contactId: user.contactId,
        username: user.username,
        email: user.username,
        fullName: user.fullName,
        roles: user.roles,
        isActive: user.isActive,
      })
    ).token;

    const resetLink = `${process.env.APP_URL}/#/reset-password/${token}`;
    const mailerData: IEmail = {
      to: `${(await user).username}`,
      subject: 'Account Activated!',
      html: `
                <h3>Hello ${user.fullName}</h3></br>
                <h4>Your Account Has Been Activated!!<h4></br>
                <h4>Follow This <a href=${resetLink}>Link</a> To Reset Your Password</h5>
                <p>This link should expire in 10 minutes</p>
            `,
    };

    await sendEmail(mailerData);

    return user;
  }

  async register({
    password,
    email,
    roles,
    ...rest
  }: RegisterUserDto): Promise<User> {
    const contact = await this.contactsService.createPerson({ ...rest, email });
    const user = new User();
    user.username = email;
    user.password = password;
    user.contact = Contact.ref(contact.id);
    user.isActive = true;
    user.hashPassword();
    const saveUser = await this.repository.save(user);
    if (saveUser) {
      await this.saveUserRoles(saveUser.id, roles);
    }

    return saveUser;
  }

  async findOne(id: number): Promise<UserListDto> {
    const data = await this.repository.findOne(id, {
      relations: ['contact', 'contact.person', 'userRoles', 'userRoles.roles'],
    });

    return this.toListModel(data);
  }

  async update(data: UpdateUserDto): Promise<UserListDto> {
    const _user = await this.findOne(data.id);

    if (data.oldPassword) {
      const oldPassword = await (await this.findByName(_user.username))
        .password;
      const isSame = bcrypt.compareSync(data.oldPassword, oldPassword);
      if (!isSame) {
        throw new HttpException('Old Password Is Incorrect', 406);
      }
    }

    const update: QueryDeepPartialEntity<User> = {
      isActive: data.isActive ? data.isActive : _user.isActive,
    };

    if (hasValue(data.password)) {
      const user = new User();
      user.password = data.password;
      user.hashPassword();
      update.password = user.password;
    }

    if (data.roles.length > 0) {
      //USER DATA is source of truth for updating user roles
      const dbUserRolesStrArr: string[] = [];
      const sentRolesStrArr: string[] = [];
      const getdbUserRoles = await this.userRolesRepository.find({
        relations: ['roles'],
        where: { userId: data.id },
      });
      getdbUserRoles.map((it: UserRoles) =>
        dbUserRolesStrArr.push(it.roles.role),
      );

      const getRoles = await this.rolesRepository.find({
        where: { role: In(data.roles) },
      });
      getRoles.map((it: Roles) => sentRolesStrArr.push(it.role));
      const currentDbRoles = getdbUserRoles.map((it: UserRoles) => ({
        id: it.id,
        rolesId: it.rolesId,
        role: it.roles.role,
      }));
      const getRolesIds = getRoles.map((it: Roles) => ({
        id: it.id,
        role: it.role,
      }));

      if (!this.compareArrays(dbUserRolesStrArr, sentRolesStrArr)) {
        const toDelete = differenceBy(currentDbRoles, getRolesIds, 'role');
        toDelete.map(
          async (it) => await this.userRolesRepository.delete(it.id),
        );

        const toAdd = differenceBy(getRolesIds, currentDbRoles, 'role');
        toAdd.map(async (it) => await this.saveUserRoles(data.id, [it.role]));
      }
    }

    const resp = await this.repository
      .createQueryBuilder()
      .update()
      .set(update)
      .where('id = :id', { id: data.id })
      .execute();

    const updated = await this.findOne(data.id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByName(username: string): Promise<User | undefined> {
    return this.repository.findOne({
      where: { username },
      relations: ['contact', 'contact.person', 'userRoles', 'userRoles.roles'],
    });
  }

  async exists(username: string): Promise<boolean> {
    const count = await this.repository.count({ where: { username } });
    return count > 0;
  }

  async saveUserRoles(userid: number, roles: string[]) {
    const rolesToRegister = await this.rolesRepository.find({
      where: { role: In(roles) },
    });
    const roleIds = rolesToRegister.map((it: Roles) => it.id);

    roleIds.map(async (it) => {
      const toSave = new UserRoles();
      toSave.userId = userid;
      toSave.rolesId = it;
      const saveRoles = await this.userRolesRepository.save(toSave);

      if (!saveRoles) {
        throw new HttpException(`Failed To Create User Roles`, 400);
      }
    });
  }

  compareArrays(a: any[], b: any[]) {
    return (
      isArray(a) &&
      isArray(b) &&
      a.length === b.length &&
      a.every((ele) => b.includes(ele))
    );
  }
}
