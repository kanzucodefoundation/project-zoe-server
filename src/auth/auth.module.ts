import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtHelperService } from './jwt-helpers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import Roles from 'src/users/entities/roles.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Roles]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60m' },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, JwtHelperService],
  exports: [AuthService, JwtHelperService],
})
export class AuthModule {}
