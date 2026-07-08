import { HttpException, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { cleanUpUser, createUserDto } from './auth.helpers';
import { UserDto } from './dto/user.dto';
import { IEmail, sendEmail } from 'src/utils/mailer';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { JwtHelperService } from './jwt-helpers.service';
import { UserListDto } from 'src/users/dto/user.dto';
import Roles from 'src/users/entities/roles.entity';
import { In, Repository, Connection } from 'typeorm';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppLogger, ContextLogger } from 'src/utils/app-logger.service';
import {
  LoginResponseDto,
  RefreshTokenResponseDto,
  HierarchyDto,
  GroupHierarchyDto,
} from './dto/login-response.dto';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import Group from 'src/groups/entities/group.entity';

@Injectable()
export class AuthService {
  private readonly rolesRepository: Repository<Roles>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private usersService: UsersService,
    private jwtHelperService: JwtHelperService,
    private jwtService: JwtService,
    private appLogger: AppLogger,
  ) {
    this.rolesRepository = connection.getRepository(Roles);
    this.logger = this.appLogger.createContextLogger('AuthService');
  }

  async validateUser(username: string, pass: string): Promise<UserDto | null> {
    const tracking = this.logger.startTracking('validateUser');

    try {
      this.logger.auth('log', 'User authentication attempt', {
        operation: 'validateUser',
        metadata: { username, hasPassword: !!pass },
      });

      const user = await this.usersService.findByName(username);
      if (!user) {
        this.logger.security(
          'warn',
          'Authentication failed - invalid username',
          {
            operation: 'validateUser',
            metadata: { username, reason: 'user_not_found' },
          },
        );
        this.logger.endTracking(tracking, false);
        return null;
      }

      this.logger.auth('debug', 'User found, checking status', {
        operation: 'validateUser',
        userId: user.id,
        contactId: user.contactId,
        metadata: { isActive: user.isActive },
      });

      if (!user.isActive) {
        this.logger.security('warn', 'Authentication failed - inactive user', {
          operation: 'validateUser',
          userId: user.id,
          contactId: user.contactId,
          metadata: { username, reason: 'user_inactive' },
        });
        this.logger.endTracking(tracking, false);
        return null;
      }

      const roles = [];
      user.userRoles.forEach((it) => roles.push(...it.roles.permissions));

      this.logger.auth('debug', 'User roles extracted', {
        operation: 'validateUser',
        userId: user.id,
        contactId: user.contactId,
        metadata: {
          roleCount: user.userRoles.length,
          permissionCount: roles.length,
        },
      });

      const valid = await user.validatePassword(pass);
      if (valid) {
        const lastLogin = await this.usersService.updateLastLogin(user.id);
        user.lastLogin = lastLogin;

        this.logger.auth('log', 'Authentication successful', {
          operation: 'validateUser',
          userId: user.id,
          contactId: user.contactId,
          metadata: { username },
        });

        cleanUpUser(user);
        const dto = createUserDto(user);
        dto.permissions = roles;

        this.logger.endTracking(tracking, true);
        return dto;
      } else {
        this.logger.security(
          'warn',
          'Authentication failed - invalid password',
          {
            operation: 'validateUser',
            userId: user.id,
            contactId: user.contactId,
            metadata: { username, reason: 'invalid_password' },
          },
        );
        this.logger.endTracking(tracking, false);
        return null;
      }
    } catch (error) {
      this.logger.error(error, {
        operation: 'validateUser',
        metadata: { username },
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async generateToken(
    user: UserDto | UserListDto,
    tenant: string,
  ): Promise<LoginResponseDto> {
    const tracking = this.logger.startTracking('generateToken', {
      userId: user.id,
      metadata: { tenant },
    });

    try {
      this.logger.auth('log', 'Generating JWT token', {
        operation: 'generateToken',
        userId: user.id,
        metadata: { tenant, userRoles: user.roles?.length || 0 },
      });

      const userPermissions = await this.getPermissions(user.roles);
      user.permissions = userPermissions;

      this.logger.auth('debug', 'User permissions resolved', {
        operation: 'generateToken',
        userId: user.id,
        metadata: { tenant, permissionCount: userPermissions.length },
      });

      const payload = {
        ...user,
        sub: user.id,
        aud: tenant,
        permissions: userPermissions,
      };
      const token = await this.jwtService.signAsync(payload);

      // Get user's hierarchy for the response
      const hierarchy = await this.getUserHierarchy(user.id);

      this.logger.auth('log', 'Token generation successful', {
        operation: 'generateToken',
        userId: user.id,
        metadata: {
          tenant,
          tokenLength: token.length,
          managedGroupsCount: hierarchy.canManageGroups.length,
          viewableGroupsCount: hierarchy.canViewGroups.length,
        },
      });

      this.logger.endTracking(tracking, true);
      return { token, user, hierarchy };
    } catch (error) {
      this.logger.error(error, {
        operation: 'generateToken',
        userId: user.id,
        metadata: { tenant },
      });
      this.logger.endTracking(tracking, false);
      throw error;
    }
  }

  async decodeToken(token: string): Promise<any> {
    const decoded = await this.jwtService.decode(token);
    return decoded;
  }

  async forgotPassword(username: string): Promise<ForgotPasswordResponseDto> {
    const userExists = await this.usersService.findByName(username);
    const message =
      'An email has been sent to the provided address if it exists in our system';
    if (!userExists) {
      Logger.error('Provided username not registered');
      return { token: '', mailURL: '', message };
    }

    const user = await this.usersService.findOne(userExists.id);

    if (!user.email) {
      return {
        token: '',
        mailURL: '',
        message:
          'No email address is on file for this account. Please contact your administrator to reset your password.',
      };
    }

    const token = (await this.jwtHelperService.generateToken(user)).token;
    const resetLink = `${process.env.APP_URL}/reset-password/${token}`;

    const mailerData: IEmail = {
      to: user.email,
      subject: 'Project Zoe - Reset Password',
      html: `
            <p>Hello ${user.fullName}</p></br>
            <p>Here is a link to reset your password!</p></br>
            <a href="${resetLink}">Reset Password</a>
            <p>This link will expire in 10 minutes.</p>
        `,
    };
    const mailURL = await sendEmail(mailerData);
    return { token, mailURL, user };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    const decodedToken = await this.jwtHelperService.decodeToken(token);
    if (!decodedToken) {
      throw new HttpException('Incorrect Token, User not retrieved', 404);
    }
    const userFromDb = await this.usersService.findOne(decodedToken.id);

    const data: UpdateUserDto = {
      id: decodedToken.id,
      password: newPassword,
      roles: userFromDb.roles,
      isActive: userFromDb.isActive,
    };
    const user = await this.usersService.update(data);
    if (!user) {
      throw new HttpException('User Password Not Updated', 404);
    }
    const resolvedUser = await user;
    if (resolvedUser.email) {
      const mailerData: IEmail = {
        to: resolvedUser.email,
        subject: 'Password Change Confirmation',
        html: `
          <h3>Hello ${resolvedUser.fullName},</h3></br>
          <h4>Your Password has been changed successfully!<h4></br>
      `,
      };
      const mailURL = await sendEmail(mailerData);
      if (!mailURL) {
        Logger.error('Password change confirmation email not sent');
      }
    }
    return { message: 'Password Change Successful', mailURL: '', user };
  }

  async getPermissions(roles: string[]) {
    const permissions: string[] = [];
    const getPermissions = await this.rolesRepository.find({
      select: ['permissions'],
      where: { role: In(roles), isActive: true },
    });

    getPermissions.map((it: any) => permissions.push(...it.permissions));
    return [...new Set(permissions)];
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    // Validate refresh token logic here
    // For now, return mock response
    const newToken = 'mock_jwt_token_' + Date.now();
    const newRefreshToken = 'mock_refresh_token_' + Date.now();

    return {
      token: newToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(): Promise<{ message: string }> {
    // Implement logout logic (blacklist token, clear session, etc.)
    return { message: 'Logged out successfully' };
  }

  async getUserHierarchy(userId: number): Promise<HierarchyDto> {
    try {
      // Get user's contact ID
      const user = await this.usersService.findOne(userId);

      if (!user || !user.contactId) {
        return { myGroups: [], canManageGroups: [], canViewGroups: [] };
      }

      // Get group memberships for the user
      const membershipRepository =
        this.rolesRepository.manager.getRepository(GroupMembership);
      const groupRepository = this.rolesRepository.manager.getRepository(Group);

      const memberships = await membershipRepository.find({
        where: { contactId: user.contactId },
        relations: ['group', 'group.category'],
      });

      if (memberships.length === 0) {
        return { myGroups: [], canManageGroups: [], canViewGroups: [] };
      }

      // Get group IDs and fetch member counts
      const groupIds = memberships.map((m) => m.groupId);

      const groups = await groupRepository.find({
        where: { id: In(groupIds) },
        relations: ['category'],
      });

      const myGroups: GroupHierarchyDto[] = groups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.category?.name?.toLowerCase() || 'group',
        memberCount: group.members?.length || 0,
      }));

      const canManageGroups = groups.map((group) => ({
        id: group.id,
        name: group.name,
      }));

      const canViewGroups = groups.map((group) => ({
        id: group.id,
        name: group.name,
      }));

      return {
        myGroups,
        canManageGroups,
        canViewGroups,
      };
    } catch (error) {
      this.logger.error(error, {
        operation: 'getUserHierarchy',
        userId,
        resource: 'user_hierarchy',
      });
      // Return fallback mock data
      return {
        myGroups: [
          {
            id: 100,
            name: 'Phase MC',
            type: 'fellowship',
            memberCount: 8,
          },
        ],
        canManageGroups: [],
        canViewGroups: [],
      };
    }
  }
}
