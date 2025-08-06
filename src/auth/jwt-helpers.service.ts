import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserListDto } from "src/users/dto/user.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
import { UserDto } from "./dto/user.dto";
import { JwtSignOptions } from "@nestjs/jwt";

@Injectable()
export class JwtHelperService {
  constructor(private readonly jwtService: JwtService) {}

  async generateToken(
    user: UserDto | UserListDto,
    options?: JwtSignOptions,
  ): Promise<LoginResponseDto> {
    const payload = { ...user, sub: user.id };
    const token = await this.jwtService.signAsync(payload, options);
    return { token, user };
  }

  async decodeToken(token: string): Promise<any> {
    const decoded = await this.jwtService.decode(token);
    return decoded;
  }
}
