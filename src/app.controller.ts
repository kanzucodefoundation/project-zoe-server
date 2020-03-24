import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from './auth/guards/local-auth.guard';
import { AuthService } from './auth/auth.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import LoginDto from './auth/dto/login.dto';
import { LoginResponseDto } from './auth/dto/login-response.dto';

@ApiTags("Index")
@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) {
  }

  @ApiBody({ type: LoginDto })
  @UseGuards(LocalAuthGuard)
  @Post('api/auth/login')
  async login(@Request() req): Promise<LoginResponseDto> {
    return this.authService.generateToken(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('api/auth/profile')
  getProfile(@Request() req): Promise<LoginResponseDto> {
    return req.user;
  }
}
