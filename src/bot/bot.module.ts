import { Module } from "@nestjs/common";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";
import { SessionService } from "./session.service";
import { ExitChatHandler } from "./chat-flows/handler-interface";
import {
  WelcomeActionHandler,
  WelcomeHandler,
} from "./chat-flows/welcome-handler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appEntities } from "../config";
import { chatHandlerProviders } from "./bot.helpers";

@Module({
  imports: [TypeOrmModule.forFeature([...appEntities])],
  controllers: [BotController],
  providers: [BotService, SessionService, ...chatHandlerProviders],
})
export class BotModule {}
