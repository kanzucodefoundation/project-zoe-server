import { HttpException, Injectable, Inject, Logger } from "@nestjs/common";
import { In, Repository, Connection, ILike } from "typeorm";
import { User } from "./entities/user.entity";
import Email from "src/crm/entities/email.entity";
import { RegisterUserDto } from "../auth/dto/register-user.dto";
import { ContactsService } from "../crm/contacts.service";
import Contact from "../crm/entities/contact.entity";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserListDto } from "./dto/user.dto";
import { getPersonFullName } from "../crm/crm.helpers";
import * as bcrypt from "bcrypt";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { CreateUserDto } from "./dto/create-user.dto";
import { IEmail, sendEmail } from "src/utils/mailer";
import { hasNoValue, hasValue, isArray } from "../utils/validation";
import { JwtHelperService } from "src/auth/jwt-helpers.service";
import Roles from "./entities/roles.entity";
import UserRoles from "./entities/userRoles.entity";
import { differenceBy, intersection } from "lodash";
import Person from "src/crm/entities/person.entity";
import { UserSearchDto } from "src/crm/dto/user-search.dto";

@Injectable()
export class UsersService {
  private readonly repository: Repository<User>;
  private readonly emailRepository: Repository<Email>;
  private readonly rolesRepository: Repository<Roles>;
  private readonly userRolesRepository: Repository<UserRoles>;
  private readonly personRepository: Repository<Person>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private readonly contactsService: ContactsService,
    private readonly jwtHelperService: JwtHelperService,
  ) {
    this.repository = connection.getRepository(User);
    this.personRepository = connection.getRepository(Person);
    this.emailRepository = connection.getRepository(Email);
    this.rolesRepository = connection.getRepository(Roles);
    this.userRolesRepository = connection.getRepository(UserRoles);
  }

  async findAll(req: UserSearchDto): Promise<UserListDto[]> {
    try {
      let hasFilter = false;
      let idList: number[] = [];

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
        idList.push(...resp.map((it) => it.contactId));

        const respEmail = await this.emailRepository.find({
          select: ["contactId"],
          where: { value: ILike(`%${req.query.trim().toLowerCase()}%`) },
        });

        idList.push(...respEmail.map((it) => it.contactId));
      }

      console.log("IdList", idList);
      if (hasFilter && hasNoValue(idList)) {
        return [];
      }

      const data = await this.repository.find({
        relations: [
          "contact",
          "contact.person",
          "userRoles",
          "userRoles.roles",
        ],
        skip: req.skip,
        take: req.limit,
        where: hasValue(idList) ? { id: In(idList) } : undefined,
      });

      return data.map((it) => {
        return this.toListModel(it);
      });
    } catch (error) {
      Logger.error(error.message);
      return [];
    }
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

  async create(data: User): Promise<User> {
    data.hashPassword();

    return await this.repository.save(data);
  }

  async createUser(data: CreateUserDto): Promise<UserListDto> {
    if (!(await this.contactsService.findOne(data.contactId))) {
      throw new HttpException("Visitor Not Found", 404);
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
      throw new HttpException("User Not Created", 400);
    } else {
      this.saveUserRoles(saveUser.contactId, data.roles);
    }

    const user = await this.findOne(saveUser.id);

    if (!user) {
      this.remove(user.id);

      throw new HttpException("Failed To Create User", 400);
    }

    const tokenOptions = { expiresIn: "1d" };
    const token = (
      await this.jwtHelperService.generateToken(
        {
          id: user.id,
          contactId: user.contactId,
          username: user.username,
          email: user.username,
          fullName: user.fullName,
          roles: user.roles,
          isActive: user.isActive,
        },
        tokenOptions,
      )
    ).token;

    const resetLink = `${process.env.APP_URL}/#/reset-password/${token}`;
    const mailerData: IEmail = {
      to: `${(await user).username}`,
      subject: "Project Zoe - Worship Harvest - Account Activated!",
      html: `
                <p>Hello ${user.fullName},</p></br>
                <p>The Lamb has won! So, your account has been created in the Project Zoe church management platform.<p></br>
                <p>Follow this <a href=${resetLink}>link</a> to reset your password</p>
                <p>This link will expire in 1 day</p>
            `,
    };
    const mailURL = await sendEmail(mailerData);
    // return { token, mailURL, user };
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
    const data = await this.repository.findOne({
      relations: ["contact", "contact.person", "userRoles", "userRoles.roles"],
      where: { id: id },
    });

    return this.toListModel(data);
  }

  async update(data: UpdateUserDto): Promise<UserListDto> {
    const _user = await this.findOne(data.id);

    if (data.oldPassword) {
      const oldPassword = (await this.findByName(_user.username)).password;
      const isSame = bcrypt.compareSync(data.oldPassword, oldPassword);
      if (!isSame) {
        throw new HttpException("Old Password Is Incorrect", 406);
      }
    }

    const update: QueryDeepPartialEntity<User> = {
      isActive: data.isActive,
    };

    if (hasValue(data.password)) {
      const user = new User();
      user.password = data.password;
      user.hashPassword();
      update.password = user.password;
    }

    if (data.roles.length > 0) {
      const dbUserRolesStrArr: string[] = [];
      const sentRolesStrArr: string[] = [];
      const getdbUserRoles = await this.userRolesRepository.find({
        relations: ["roles"],
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
        const toDelete = differenceBy(currentDbRoles, getRolesIds, "role");
        toDelete.map(
          async (it) => await this.userRolesRepository.delete(it.id),
        );

        const toAdd = differenceBy(getRolesIds, currentDbRoles, "role");
        toAdd.map((it) => this.saveUserRoles(data.id, [it.role]));
      }
    }

    const resp = await this.repository
      .createQueryBuilder()
      .update()
      .set(update)
      .where("id = :id", { id: data.id })
      .execute();

    return await this.findOne(data.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findByName(username: string): Promise<User | undefined> {
    return this.repository.findOne({
      where: { username: ILike(username) },
      relations: ["contact", "contact.person", "userRoles", "userRoles.roles"],
    });
  }

  async findByRole(roleName: string): Promise<User[] | undefined> {
    try {
      // Find the role by its name
      const role = await this.rolesRepository.findOne({
        where: { role: roleName },
      });

      if (!role) {
        throw new Error(`Role with name ${roleName} not found`);
      }

      // Find users with the specified role
      return await this.repository
        .createQueryBuilder("user")
        .innerJoinAndSelect("user.userRoles", "userRoles")
        .innerJoinAndSelect("userRoles.roles", "roles")
        .leftJoinAndSelect("user.contact", "contact")
        .where("roles.id = :roleId", { roleId: role.id })
        .getMany();
    } catch (error) {
      throw error;
    }
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
