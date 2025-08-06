import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { VendorModule } from "src/vendor/vendor.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appEntities } from "src/config";
import { GroupsService } from "src/groups/services/groups.service";
import { GroupPermissionsService } from "src/groups/services/group-permissions.service";

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, GroupsService, GroupPermissionsService],
})
export class ReportsModule {}
