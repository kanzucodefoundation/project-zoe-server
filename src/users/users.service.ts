import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import Email from 'src/crm/entities/email.entity';
import { RegisterUserDto } from '../auth/dto/register-user.dto';
import SearchDto from '../shared/dto/search.dto';
import { ContactsService } from '../crm/contacts.service';
import Contact from '../crm/entities/contact.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto } from './dto/user-list.dto';
import { getPersonFullName } from '../crm/crm.helpers';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserResponseDto } from './dto/create-user-response.dto';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import { JwtService } from '@nestjs/jwt';
import { UserDto } from 'src/auth/dto/user.dto';
import { LoginResponseDto } from 'src/auth/dto/login-response.dto';
import { hasValue } from '../utils/validation';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    private readonly jwtService: JwtService,
    private readonly contactsService: ContactsService,
  ) {}

  async findAll(req: SearchDto): Promise<UserListDto[]> {
    const data = await this.repository.find({
      relations: ['contact', 'contact.person'],
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
      roles: user.roles,
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

  async createUser(data: CreateUserDto): Promise<CreateUserResponseDto> {
    if (!(await this.contactsService.findOne(data.contactId))) {
      throw new HttpException('Visitor Not Found', 404);
    }
    const email = await this.emailRepository.findOne({
      where: { contactId: data.contactId },
    });
    const toSave = new User();
    toSave.username = email.value;
    toSave.contactId = data.contactId;
    toSave.password = data.password;
    toSave.roles = data.roles;
    toSave.isActive = data.isActive;
    toSave.hashPassword();

    const saveUser = await this.create(toSave);
    if (!saveUser) {
      this.remove(saveUser.id);
      throw new HttpException('User Not Created', 400);
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
    const mailURL = await sendEmail(mailerData);

    return { token, mailURL, user };
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
    user.roles = roles;
    user.isActive = true;
    user.hashPassword();
    return await this.repository.save(user);
  }

  async findOne(id: number): Promise<UserListDto> {
    const data = await this.repository.findOne(id, {
      relations: ['contact', 'contact.person'],
    });
    return this.toListModel(data);
  }

  async update(data: UpdateUserDto): Promise<UserListDto> {
    const update: QueryDeepPartialEntity<User> = {
      roles: data.roles,
      isActive: data.isActive,
    };

    if (hasValue(data.password)) {
      const user = new User();
      user.password = data.password;
      user.hashPassword();
      update.password = user.password;
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
      relations: ['contact', 'contact.person'],
    });
  }

  async exits(username: string): Promise<boolean> {
    const count = await this.repository.count({ where: { username } });
    return count > 0;
  }
}
