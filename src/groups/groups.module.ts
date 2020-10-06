import { HttpModule, Module } from '@nestjs/common';
import { GroupsService } from './services/groups.service';
import { GroupCategoriesService } from './services/group-categories.service';
import { GroupController } from './controllers/group.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { groupEntities } from './groups.helpers';
import { GroupCategoryController } from './controllers/group-category.controller';
import { GroupComboController } from './controllers/group-combo.controller';
import { GroupsMembershipService } from './services/group-membership.service';
import { GroupMembershipController } from './controllers/group-membership.controller';
import { VendorModule } from '../vendor/vendor.module';

@Module({
  imports: [
    VendorModule,HttpModule,
    TypeOrmModule.forFeature([...groupEntities])
  ],
  providers: [GroupsService, GroupCategoriesService, GroupsMembershipService],
  controllers: [GroupController, GroupCategoryController, GroupComboController, GroupMembershipController],
  exports: [GroupsService, GroupCategoriesService],
})
export class GroupsModule {
}
