import { Injectable, Logger } from "@nestjs/common";
import { UssdRequestDto } from "./dto/ussd-request.dto";
import { SessionService } from "./session.service";
import { ChatNode } from "./entities/chat-node.entity";
import { ChatSession } from "./entities/chat-session.entity";
import { ChatAction } from "./dto/ussd-response.dto";
import { ChatHandler, ExitChatHandler } from "./chat-flows/handler-interface";
import { ModuleRef } from "@nestjs/core";
import { chatHandlerProviders } from "./bot.helpers";
import { WelcomeHandler } from "./chat-flows/welcome-handler";

@Injectable()
export class BotService {
  constructor(
    private sessionService: SessionService,
    private moduleRef: ModuleRef,
  ) {}

  async process(request: UssdRequestDto): Promise<ChatNode> {
    const logTag = `BotService.process ${request.phoneNumber} ${request.sessionId}`;
    Logger.log(`${logTag} started`);
    const session = await this.sessionService.loadSession(request);
    const userInput = request.text.trim();
    session.userPath = userInput;

    let nextHandler: string;
    if (userInput === "exit") {
      nextHandler = ExitChatHandler.name;
    } else if (session.nodes.length === 0) {
      nextHandler = WelcomeHandler.name;
      Logger.log(`${logTag} using RootHandler`);
    } else if (userInput === "00") {
      Logger.log(`${logTag} popping chat node`);
      return await this.sessionService.popChatNode(session);
    } else {
      const lastNode = session.nodes[session.nodes.length - 1];
      nextHandler = lastNode.nextHandler;
    }

    const handlerService = this.getHandlerService(nextHandler);
    if (!handlerService) {
      Logger.error(`Handler not found: ${nextHandler}`);
      return this.errorChatNode(session, request.text);
    }

    Logger.log(`${logTag} using ${handlerService.constructor.name}`);
    const result = await handlerService.execute(userInput, session);
    await this.sessionService.updateSession(session, result);
    return result;
  }

  private getHandlerService(handlerName: string): ChatHandler {
    Logger.log(`getHandlerService ${handlerName}`);
    try {
      const handler = chatHandlerProviders.find(
        (handler) => handler.name === handlerName,
      );
      return this.moduleRef.get(handler, { strict: false });
    } catch (e) {
      Logger.error(`getHandlerService ${handlerName} failed`, e);
      return null;
    }
  }

  private errorChatNode(session: ChatSession, text: string): ChatNode {
    return {
      name: "Error",
      userInput: text,
      message: "Sorry, something went wrong. Please try again later.",
      nodeAction: ChatAction.End,
      session,
      hasError: true,
      sessionId: session.id,
      nextHandler: "ExitChatHandler",
      createdAt: new Date(),
      id: 0,
    };
  }
}
