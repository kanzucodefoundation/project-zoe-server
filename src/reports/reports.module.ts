import { HttpModule, Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { Report } from "./entities/report.entity";
import { ReportSubmission } from "./entities/report.submission.entity";
import { User } from "src/users/entities/user.entity";
import { VendorModule } from "src/vendor/vendor.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appEntities } from "src/config";

@Module({
  imports: [
    VendorModule,
    HttpModule,
    TypeOrmModule.forFeature([...appEntities]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
