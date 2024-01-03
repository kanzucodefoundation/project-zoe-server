import { Body, Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { SentryInterceptor } from "../utils/sentry.interceptor";
import { ApiTags } from "@nestjs/swagger";
import { BotService } from "./bot.service";
import { UssdRequestDto } from "./dto/ussd-request.dto";
import { ChatAction } from "./dto/ussd-response.dto";
import { cleanUp } from "./bot.helpers";
import { GoogleSheetsService } from "./google-sheets.service";
import { format } from "date-fns";

@Controller("api/bot")
@UseInterceptors(SentryInterceptor)
@ApiTags("USSD")
export class BotController {
  constructor(
    private readonly service: BotService,
    private readonly sheetsService: GoogleSheetsService,
  ) {}

  @Get()
  async test(): Promise<string> {
    const event = "-NA-";
    const date = format(new Date(), "dd/MM/yyyy");
    this.sheetsService
      .addRowToSheet([
        ["Sample Name", date, event, "0700111111", "Sample Address"],
      ])
      .then(() => {
        console.log("Successfully added row to sheet");
      });
    return "It works!";
  }

  @Post("ussd/at")
  async africaZTalking(@Body() request: UssdRequestDto): Promise<string> {
    const requestData = { ...request, text: cleanUp(request.text) };
    const response = await this.service.process(requestData);
    const action = response.nodeAction === ChatAction.Prompt ? "CON " : "END ";
    return action + response.message;
  }
}
