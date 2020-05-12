import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { cleanUpUser, createUserDto } from './auth.helpers';
import { UserDto } from './dto/user.dto';
import { LoginResponseDto } from './dto/login-response.dto';


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

  async generateToken(user: UserDto): Promise<LoginResponseDto> {
    const payload = { ...user, sub: user.id };
    const token = await this.jwtService.signAsync(payload);
    return { token, user };
  }
}
