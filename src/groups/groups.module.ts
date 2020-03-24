import { Module } from '@nestjs/common';
import { GroupsService } from './services/groups.service';
import { GroupCategoriesService } from './services/group-categories.service';
import { GroupsController } from './controllers/groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { groupEntities } from './groups.helpers';
import { GroupCategoriesController } from './controllers/group-categories.controller';
import { GroupsComboController } from './controllers/groups.combo.controller';

@Module({
  imports:[TypeOrmModule.forFeature([...groupEntities])],
  providers: [GroupsService, GroupCategoriesService],
  controllers: [GroupsController,GroupCategoriesController,GroupsComboController],
  exports: [GroupsService, GroupCategoriesService],
})
export class GroupsModule {
}
