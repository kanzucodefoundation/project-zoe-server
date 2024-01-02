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

export function cleanUpNoTrim(str: string): string {
  return this.replace(/^[ \t]+/gm, "");
}

export function maskSensitiveData(str: string): string {
  // leave fist 2 and last 3 characters
  return this.replace(/(?<=\w{2})\w(?=\w{3})/g, "*");
}
