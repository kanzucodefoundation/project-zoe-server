import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
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
import { AddressesService } from "src/crm/addresses.service";
import { GroupPermissionsService } from "./services/group-permissions.service";
import { nameTenantHeaderMiddleware } from "src/middleware/nameTenantHeader.middleware";
import { MiddlewareConsumer } from "@nestjs/common";

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
    AddressesService,
    PrismaService,
    EventsService,
    GroupPermissionsService,
  ],
  controllers: [
    GroupController,
    GroupCategoryController,
    GroupComboController,
    GroupMembershipController,
    GroupMembershipReqeustController,
  ],
  exports: [GroupsService, GroupCategoriesService, GroupPermissionsService],
})
export class GroupsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(nameTenantHeaderMiddleware)
      .forRoutes("api/groups/combo/locations");
  }
}
