import { ChatSession } from "./entities/chat-session.entity";
import { ChatNode } from "./entities/chat-node.entity";
import {
  AddressEnteredHandler,
  NameEnteredHandler,
  WelcomeActionHandler,
  WelcomeHandler,
} from "./chat-flows/welcome-handler";
import { ExitChatHandler } from "./chat-flows/handler-interface";

export const botEntities = [ChatSession, ChatNode];

export const chatHandlerProviders = [
  WelcomeHandler,
  WelcomeActionHandler,
  ExitChatHandler,
  NameEnteredHandler,
  AddressEnteredHandler,
];

export function cleanUp(str: string): string {
  return str.replace(/^[ \t]+/gm, "").trim();
}
