import {
  HttpException,
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { In, Repository, Connection, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import Email from 'src/crm/entities/email.entity';
import { RegisterUserDto } from '../auth/dto/register-user.dto';
import { ContactsService } from '../crm/contacts.service';
import Contact from '../crm/entities/contact.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto } from './dto/user.dto';
import { getPersonFullName } from '../crm/crm.helpers';
import * as bcrypt from 'bcrypt';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CreateUserDto } from './dto/create-user.dto';
import { IEmail, sendEmail } from 'src/utils/mailer';
import { hasNoValue, hasValue, isArray } from '../utils/validation';
import { JwtHelperService } from 'src/auth/jwt-helpers.service';
import Roles from './entities/roles.entity';
import UserRoles from './entities/userRoles.entity';
import { differenceBy } from 'lodash';
import { UserSearchDto } from 'src/crm/dto/user-search.dto';
import Person from 'src/crm/entities/person.entity';
import { GroupsMembershipService } from '../groups/services/group-membership.service';
import { GroupRole } from '../groups/enums/groupRole';
import { TenantContext } from '../shared/tenant/tenant-context';
import { Tenant } from '../tenants/entities/tenant.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import { GroupRepository } from '../shared/repository/group.repository';

@Injectable()
export class UsersService {
  private readonly repository: Repository<User>;
  private readonly emailRepository: Repository<Email>;
  private readonly rolesRepository: Repository<Roles>;
  private readonly userRolesRepository: Repository<UserRoles>;
  private readonly personRepository: Repository<Person>;
  // Tenant-scoped: findNearestFobAncestor relies on this auto-applying the
  // tenant filter instead of every call site re-supplying `tenant: { id }`.
  private readonly groupRepository: GroupRepository;
  // GroupMembership has no direct tenant column (it's scoped via its
  // `group` relation), so this stays a plain repository with an explicit
  // `group.tenantId` join filter, matching TasksService's convention.
  private readonly membershipRepository: Repository<GroupMembership>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly contactsService: ContactsService,
    private readonly jwtHelperService: JwtHelperService,
    private readonly groupsMembershipService: GroupsMembershipService,
    private readonly tenantContext: TenantContext,
    private readonly groupsPermissionsService: GroupPermissionsService,
  ) {
    this.repository = connection.getRepository(User);
    this.emailRepository = connection.getRepository(Email);
    this.rolesRepository = connection.getRepository(Roles);
    this.userRolesRepository = connection.getRepository(UserRoles);
    this.personRepository = connection.getRepository(Person);
    this.groupRepository = new GroupRepository(
      connection.manager,
      tenantContext,
    );
    this.membershipRepository = connection.getRepository(GroupMembership);
  }

  async findAll(req: UserSearchDto): Promise<UserListDto[]> {
    try {
      let hasFilter = false;
      const idList: number[] = [];

      if (hasValue(req.query)) {
        hasFilter = true;
        const query = req.query.trim();

        const respUsers = await this.repository.find({
          select: ['contactId'],
          where: { username: ILike(`%${query}%`) },
        });
        idList.push(...respUsers.map((it) => it.contactId));

        const resp = await this.personRepository.find({
          select: ['contactId'],
          where: [
            {
              firstName: ILike(`%${query}%`),
            },
            {
              lastName: ILike(`%${query}%`),
            },
            {
              middleName: ILike(`%${query}%`),
            },
          ],
        });
        idList.push(...resp.map((it) => it.contactId));

        const respEmail = await this.emailRepository.find({
          select: ['contactId'],
          where: { value: ILike(`%${query.toLowerCase()}%`) },
        });
        idList.push(...respEmail.map((it) => it.contactId));
      }

      if (hasFilter && hasNoValue(idList)) {
        return [];
      }

      const data = await this.repository.find({
        relations: [
          'contact',
          'contact.person',
          'userRoles',
          'userRoles.roles',
        ],
        skip: req.skip,
        take: req.limit,
        where: hasValue(idList)
          ? { contactId: In(Array.from(new Set(idList))) }
          : undefined,
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
    if (!user) {
      throw new Error('User is null or undefined');
    }

    const fullName = user.contact?.person
      ? getPersonFullName(user.contact.person)
      : 'Unknown User';
    return {
      avatar: user.contact?.person?.avatar || null,
      contact: {
        id: user.contactId,
        name: fullName,
      },
      id: user.id,
      roles: user.userRoles.map((it) =>
        it.roles.isActive ? it.roles.role : `${it.roles.role}: is disabled`,
      ),
      isActive: user.isActive,
      lastLogin: user.lastLogin ?? null,
      username: user.username,
      email: user.email ?? null,
      contactId: user.contactId,
      fullName,
    };
  }

  async updateLastLogin(
    id: number,
    lastLogin: Date = new Date(),
  ): Promise<Date> {
    await this.repository.update({ id }, { lastLogin });
    return lastLogin;
  }

  async create(data: User): Promise<User> {
    data.hashPassword();

    // Set tenant from context
    const tenantId = this.tenantContext.requireTenant();
    data.tenant = { id: tenantId } as Tenant;

    return await this.repository.save(data);
  }

  async createUser(data: CreateUserDto): Promise<UserListDto> {
    if (!(await this.contactsService.findOne(data.contactId))) {
      throw new HttpException('Visitor Not Found', 404);
    }

    const emailRecord = await this.emailRepository.findOne({
      where: { contactId: data.contactId },
    });

    const toSave = new User();
    toSave.id = data.contactId;
    toSave.contactId = data.contactId;
    toSave.password = data.password;
    toSave.isActive = data.isActive;

    if (emailRecord?.value) {
      // Email-bearing user: email doubles as login username
      toSave.username = emailRecord.value;
      toSave.email = emailRecord.value;
    } else if (hasValue(data.username)) {
      // Email-less user: admin supplies a login username (e.g. phone number)
      toSave.username = data.username;
      toSave.email = null;
    } else {
      throw new HttpException(
        'Contact has no email address. Provide a username for this user.',
        400,
      );
    }

    const saveUser = await this.create(toSave);

    if (!saveUser) {
      this.remove(saveUser.id);
      throw new HttpException('User Not Created', 400);
    } else {
      await this.saveUserRoles(saveUser.id, data.roles);
    }

    const user = await this.findOne(saveUser.id);

    if (!user) {
      await this.remove(saveUser.id);
      throw new HttpException('Failed To Create User', 400);
    }

    // Create group membership if groupId is provided
    if (hasValue(data.groupId)) {
      try {
        await this.groupsMembershipService.create({
          groupId: data.groupId,
          members: [saveUser.contactId],
          role: data.groupRole || GroupRole.Member,
        });
      } catch (error) {
        Logger.error(`Failed to add user to group: ${error.message}`);
        throw new HttpException('Failed to add user to group', 400);
      }
    }

    // Only send welcome email when an email address is on file
    if (user.email) {
      const tokenOptions = { expiresIn: '1d' };
      const token = (
        await this.jwtHelperService.generateToken(
          {
            id: user.id,
            contactId: user.contactId,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles,
            isActive: user.isActive,
          },
          tokenOptions,
        )
      ).token;

      const resetLink = `${process.env.APP_URL}/reset-password/${token}`;
      const mailerData: IEmail = {
        to: user.email,
        subject: 'Project Zoe - Worship Harvest - Account Activated!',
        html: `
                <p>Hello ${user.fullName},</p></br>
                <p>The Lamb has won! So, your account has been created in the Project Zoe church management platform.<p></br>
                <p>Follow this <a href=${resetLink}>link</a> to reset your password</p>
                <p>This link will expire in 1 day</p>
            `,
      };
      await sendEmail(mailerData);
    }

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
    user.email = email;
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
      relations: [
        'contact',
        'contact.person',
        'contact.tenant',
        'userRoles',
        'userRoles.roles',
      ],
      where: { id: id },
    });

    if (!data) {
      throw new Error(`User with ID ${id} not found`);
    }

    return this.toListModel(data);
  }

  async update(
    data: Partial<UpdateUserDto> & { id: number },
  ): Promise<UserListDto> {
    const _user = await this.findOne(data.id);

    if (data.oldPassword) {
      const oldPassword = (await this.findByName(_user.username)).password;
      const isSame = bcrypt.compareSync(data.oldPassword, oldPassword);
      if (!isSame) {
        throw new HttpException('Old Password Is Incorrect', 406);
      }
    }

    const update: QueryDeepPartialEntity<User> = {};

    // Only update isActive if provided
    if ('isActive' in data && data.isActive !== undefined) {
      update.isActive = data.isActive;
    }

    if (hasValue(data.password)) {
      const user = new User();
      user.password = data.password;
      user.hashPassword();
      update.password = user.password;
    }

    // Only update roles if provided and not empty
    if (hasValue(data.roles) && data.roles.length > 0) {
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
        toAdd.map((it) => this.saveUserRoles(data.id, [it.role]));
      }
    }

    if (Object.keys(update).length > 0) {
      await this.repository
        .createQueryBuilder()
        .update()
        .set(update)
        .where('id = :id', { id: data.id })
        .execute();
    }

    return await this.findOne(data.id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Lists the users belonging to a group (plus, if the group sits beneath a
   * FOB, that FOB's leaders). Requires the caller to have permission for the
   * target group — this returns member usernames/emails/roles, so it must
   * not be reachable by an arbitrary authenticated tenant user.
   */
  async findUsersInGroup(groupId: number, user: any): Promise<UserListDto[]> {
    const hasAccess = await this.groupsPermissionsService.hasPermissionForGroup(
      user,
      groupId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this group');
    }

    const tenantId = this.tenantContext.requireTenant();
    const fobGroup = await this.findNearestFobAncestor(groupId);

    const memberships = await this.membershipRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.group', 'group')
      .where('group.tenantId = :tenantId', { tenantId })
      .andWhere('membership.isActive = true')
      .andWhere(
        fobGroup
          ? '(membership.groupId = :groupId OR (membership.groupId = :fobGroupId AND membership.role = :leaderRole))'
          : 'membership.groupId = :groupId',
        { groupId, fobGroupId: fobGroup?.id, leaderRole: GroupRole.Leader },
      )
      .select(['membership.contactId'])
      .getMany();

    const contactIds = [...new Set(memberships.map((m) => m.contactId))];
    if (contactIds.length === 0) return [];

    const data = await this.repository.find({
      relations: ['contact', 'contact.person', 'userRoles', 'userRoles.roles'],
      where: { contactId: In(contactIds), tenant: { id: tenantId } },
    });
    return data.map((it) => this.toListModel(it));
  }

  /**
   * Finds the nearest ancestor group whose category is FOB, walking up
   * parentId one level at a time.
   *
   * Deliberately NOT using TreeRepository.findAncestors()/a closure-table
   * join here: that call builds its join from the entity's schema-qualified
   * table path, and when the schema is explicitly "public" TypeORM
   * misparses "public.<table>" as an alias.relation reference and throws
   * `"public" alias was not found` (a real TypeORM bug we hit in
   * production). The per-level walk is a few extra round trips on what are
   * normally shallow hierarchies, but it never touches that code path.
   */
  private async findNearestFobAncestor(
    startGroupId: number,
  ): Promise<{ id: number; name: string } | null> {
    let currentId: number | null = startGroupId;
    const visited = new Set<number>();

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);

      // groupRepository is tenant-aware, so this is implicitly scoped to
      // the current tenant without repeating `tenant: { id: tenantId }`
      // at this call site.
      const group = await this.groupRepository.findOne({
        where: { id: currentId },
        relations: { category: true },
      });

      if (!group) return null;
      // 'FOB' is a STRUCTURE-purpose category *name*, not a fixed system
      // constant like GroupCategoryPurpose — structure category names
      // (FOB, Region, Zone, Department, ...) are admin-configured per
      // tenant, so there's no enum member to reference here.
      if (group.category?.name === 'FOB') {
        return { id: group.id, name: group.name };
      }

      currentId = group.parentId ?? null;
    }

    return null;
  }

  async findByName(username: string): Promise<User | undefined> {
    return this.repository.findOne({
      where: { username: ILike(username) },
      relations: [
        'contact',
        'contact.person',
        'contact.tenant',
        'userRoles',
        'userRoles.roles',
      ],
    });
  }

  async findById(id: number): Promise<User | undefined> {
    return this.repository.findOne({
      where: { id: id },
      relations: [
        'contact',
        'contact.person',
        'contact.tenant',
        'userRoles',
        'userRoles.roles',
      ],
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
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.userRoles', 'userRoles')
        .innerJoinAndSelect('userRoles.roles', 'roles')
        .leftJoinAndSelect('user.contact', 'contact')
        .where('roles.id = :roleId', { roleId: role.id })
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

    await Promise.all(
      roleIds.map(async (it) => {
        const toSave = new UserRoles();
        toSave.userId = userid;
        toSave.rolesId = it;
        const saveRoles = await this.userRolesRepository.save(toSave);

        if (!saveRoles) {
          throw new HttpException('Failed To Create User Roles', 400);
        }
      }),
    );
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
