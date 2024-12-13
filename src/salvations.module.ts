import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SalvationController } from "./crm/contollers/salvation.controller";
import { SalvationService } from "./groups/services/salvation.service";
import { SalvationRecord } from "../src/crm/entities/salvation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([SalvationRecord])],
  controllers: [SalvationController],
  providers: [SalvationService],
})
export class SalvationModule {}
