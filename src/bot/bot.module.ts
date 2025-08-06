import { Module } from "@nestjs/common";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";
import { SessionService } from "./session.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appEntities } from "../config";
import { chatHandlerProviders } from "./bot.helpers";
import { GoogleSheetsService } from "./google-sheets.service";

@Module({
  imports: [TypeOrmModule.forFeature([...appEntities])],
  controllers: [BotController],
  providers: [
    BotService,
    SessionService,
    GoogleSheetsService,
    ...chatHandlerProviders,
  ],
})
export class BotModule {}
