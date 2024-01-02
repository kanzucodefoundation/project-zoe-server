import { Body, Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { SentryInterceptor } from "../utils/sentry.interceptor";
import { ApiTags } from "@nestjs/swagger";
import { BotService } from "./bot.service";
import { UssdRequestDto } from "./dto/ussd-request.dto";
import { ChatAction } from "./dto/ussd-response.dto";
import { cleanUp } from "./bot.helpers";

@Controller("api/bot")
@UseInterceptors(SentryInterceptor)
@ApiTags("USSD")
export class BotController {
  constructor(private readonly service: BotService) {}

  @Get()
  async test(): Promise<string> {
    return "It works!";
  }

  @Post("ussd/at")
  async africaZTalking(@Body() request: UssdRequestDto): Promise<string> {
    const requestData = { ...request, text: cleanUp(request.text) };
    const response = await this.service.process(request);
    const action = response.nodeAction === ChatAction.Prompt ? "CON " : "END ";
    return action + response.message;
  }
}
