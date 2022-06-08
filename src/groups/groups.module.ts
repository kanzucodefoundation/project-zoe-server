import { HttpModule, Module } from "@nestjs/common";
import { GroupsService } from "./services/groups.service";
import { GroupCategoriesService } from "./services/group-categories.service";
import { GroupController } from "./controllers/group.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GroupCategoryController } from "./controllers/group-category.controller";
import { GroupComboController } from "./controllers/group-combo.controller";
import { GroupsMembershipService } from "./services/group-membership.service";
import { GroupMembershipController } from "./controllers/group-membership.controller";
import { VendorModule } from "../vendor/vendor.module";
import { GroupMembershipReqeustController } from "./controllers/group-membership-request.contoller";
import { GroupMembershipRequestService } from "./services/group-membership-request.service";
import { ContactsService } from "src/crm/contacts.service";
import { GoogleService } from "../vendor/google.service";
import { PrismaService } from "../shared/prisma.service";
import { EventsService } from "src/events/events.service";
import { appEntities } from "../config";
import { GroupMissingReportsService } from "./services/group-missing-reports.service";
import { GroupReportsController } from "./controllers/group-reports.controller";
import { GroupReportFrequencyController } from "./controllers/group-frequency.controller";
import { GroupCategoryComboController } from "./controllers/group-category-combo.controller";

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  providers: [
    GroupsService,
    GroupCategoriesService,
    GroupsMembershipService,
    GroupMembershipRequestService,
    ContactsService,
    GoogleService,
    PrismaService,
    EventsService,
    GroupMissingReportsService,
  ],
  controllers: [
    GroupController,
    GroupCategoryController,
    GroupComboController,
    GroupMembershipController,
    GroupMembershipReqeustController,
    GroupReportsController,
    GroupReportFrequencyController,
    GroupCategoryComboController,
  ],
  exports: [GroupsService, GroupCategoriesService],
})
export class GroupsModule {}
