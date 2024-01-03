import { ChatSession } from "../entities/chat-session.entity";
import { ChatNode } from "../entities/chat-node.entity";
import { ChatAction } from "../dto/ussd-response.dto";
import { Injectable } from "@nestjs/common";
import { cleanUp } from "../bot.helpers";

export interface ChatHandler {
  execute(userInput: string, session: ChatSession): Promise<ChatNode>;
}

class ChatNodeCreateModel {
  nodeAction: ChatAction;
  message: string;
  nextHandler: string;
  userInput: string;
  hasError?: boolean;
  name?: string;
}

export const createNode = (
  session: ChatSession,
  model: ChatNodeCreateModel,
): ChatNode => {
  return {
    id: 0,
    createdAt: new Date(),
    message: cleanUp(model.message),
    nodeAction: model.nodeAction,
    nextHandler: model.nextHandler,
    name: model.name || "chat-node",
    userInput: model.userInput,
    hasError: model.hasError || false,
    sessionId: session.id,
  };
};

@Injectable()
export class ExitChatHandler implements ChatHandler {
  async execute(userInput: string, session: ChatSession): Promise<ChatNode> {
    const node = createNode(session, {
      nodeAction: ChatAction.End,
      userInput: userInput,
      message: "Thank you for using our service.",
      nextHandler: "",
    });
    return Promise.resolve(node);
  }
}

export const chatStrings = {
  comingSoon: "This feature is coming soon.\n Thank you for using our service.",
  invalidInput: "Invalid input. Please try again.",
};
