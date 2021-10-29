import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './auth.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import LoginDto from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  ValidateEmailDto,
  ValidatePasswordDto,
} from './dto/reset-password.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { isValidPassword } from 'src/utils/validation';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@ApiTags('Index')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @ApiBody({ type: LoginDto })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req): Promise<LoginResponseDto> {
    return this.authService.generateToken(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req): Promise<LoginResponseDto> {
    return req.user;
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() data: ValidateEmailDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(data.username);
  }

  @Put('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body() data: ValidatePasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    if (await isValidPassword(data.password)) {
      return this.authService.resetPassword(token, data.password);
    }
    throw new HttpException(
      "Invalid Password (Password Doesn't Meet Criteria)",
      404,
    );
  }
}




