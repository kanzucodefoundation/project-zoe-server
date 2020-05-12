import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { usersEntities } from './users.helpers';
import { UsersController } from './users.controller';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [TypeOrmModule.forFeature([...usersEntities]), CrmModule],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {
}
