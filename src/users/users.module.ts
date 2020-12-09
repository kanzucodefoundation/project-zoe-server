import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usersEntities } from './users.helpers';
import { UsersController } from './users.controller';
import { CrmModule } from '../crm/crm.module';
import { crmEntities } from '../crm/crm.helpers';


@Module({
  imports: [
    TypeOrmModule.forFeature([...usersEntities,...crmEntities]), 
    CrmModule,
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {
}
