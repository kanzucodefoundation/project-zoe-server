import { HttpModule, Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
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
