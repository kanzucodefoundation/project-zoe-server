import { Injectable, Logger, HttpException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { cleanUpUser, createUserDto } from './auth.helpers';
import { UserDto } from './dto/user.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {IEmail, sendEmail} from 'src/utils/mailerTest';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserListDto } from 'src/users/dto/user-list.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {
  }

  async validateUser(username: string, pass: string): Promise<UserDto | null> {
    const user = await this.usersService.findByName(username);
    if (!user) {
      Logger.warn('invalid username: ', username);
      return null;
    }
    const valid = await user.validatePassword(pass);
    if (valid) {
      cleanUpUser(user);
      return createUserDto(user);
    } else {
      Logger.warn('invalid password: ', username);
      return null;
    }
  }

  async generateToken(user: UserDto | UserListDto): Promise<LoginResponseDto> {
    const payload = { ...user, sub: user.id };
    const token = await this.jwtService.signAsync(payload);
    return { token, user };
  }

  async decodeToken(token: string): Promise<any> {
    const decoded = await this.jwtService.decode(token);
    return decoded;
  }

  async forgotPassword(username: string): Promise<ForgotPasswordResponseDto> {
    const userExists = await this.usersService.findByName(username);
    if (!userExists) {
        throw new HttpException("User Not Found", 404);
    }
    
    const user = (await this.usersService.findOne(userExists.id));
    const token = (await this.generateToken(user)).token;
    const resetLink = `http://localhost:3000/#/reset-password/${token}`;

    const mailerData: IEmail = {
        to: `${(await user).username}`,
        subject: "Reset Password",
        html: 
        `
            <h3>Hello ${user.fullName}</h3></br>
            <h4>Here is a link to reset your Password!<h4></br>
            <a href=${resetLink}>Reset Password</a>
            <p>This link should expire in 10 minutes</p>
        `
    }
    const mailURL = await sendEmail(mailerData);
    return { token, mailURL, user };
  }

  async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponseDto> {
    const decodedToken = await this.decodeToken(token);
    if(!decodedToken) {
      throw new HttpException("Incorrect Token, User not retrieved", 404);
    }
    const data: UpdateUserDto = {
      id: decodedToken.id,
      password: newPassword,
      roles: (await this.usersService.findOne(decodedToken.userId)).roles
    }
    const user = await this.usersService.update(data);
    if(!user) {
      throw new HttpException("User Password Not Updated", 404);
    }

    const mailerData: IEmail = {
      to: `${(await user).username}`,
      subject: "Password Change Confirmation",
      html:
      `
          <h3>Hello ${(await user).fullName},</h3></br>
          <h4>Your Password has been changed successfully!<h4></br>
      `
    } 
    const mailURL = await sendEmail(mailerData);
    if (mailURL) {
      const message = "Password Change Successful"
      return { message, mailURL, user };
    }
    throw new HttpException("Password Not Changed", 400);
  }

}



