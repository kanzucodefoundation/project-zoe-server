import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usersEntities } from './users.helpers';
import { UsersController } from './users.controller';
import { CrmModule } from '../crm/crm.module';
import { crmEntities } from '../crm/crm.helpers';
import { AppService } from 'src/app.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from 'src/auth/constants';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { JwtHelperService } from 'src/auth/jwt-helpers.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([...usersEntities, ...crmEntities]),
    CrmModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60m' },
    }),
  ],
  providers: [UsersService, AppService, JwtStrategy, RolesService, JwtHelperService],
  exports: [UsersService],
  controllers: [UsersController, RolesController],
})
export class UsersModule {}
