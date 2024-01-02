import { ChatSession } from "../entities/chat-session.entity";
import { ChatNode } from "../entities/chat-node.entity";
import { ChatHandler, chatStrings, createNode } from "./handler-interface";
import { ChatAction } from "../dto/ussd-response.dto";
import { Injectable } from "@nestjs/common";

const fieldNames = {
  name: "name",
  address: "address",
  phoneNumber: "phoneNumber",
};

@Injectable()
export class WelcomeHandler implements ChatHandler {
  //TODO read  church name from config, based on tenant
  message = `
  Welcome to Worship harvest.
  1. I've just gotten saved
  2. I want to join an MC
  `;

  async execute(userInput: string, session: ChatSession): Promise<ChatNode> {
    const node = createNode(session, {
      nodeAction: ChatAction.Prompt,
      userInput: userInput,
      message: this.message,
      nextHandler: WelcomeActionHandler.name,
    });
    session.metaData = {
      ...session.metaData,
      [fieldNames.phoneNumber]: session.phone,
    };
    return Promise.resolve(node);
  }
}

@Injectable()
export class WelcomeActionHandler implements ChatHandler {
  async execute(userInput: string, session: ChatSession): Promise<ChatNode> {
    let nextHandler: string;
    let action: ChatAction = ChatAction.Prompt;
    let message = "";
    switch (userInput) {
      case "1":
        nextHandler = NameEnteredHandler.name;
        message = `What is your full name?`;
        break;
      case "2":
        action = ChatAction.End;
        nextHandler = "";
        message = chatStrings.comingSoon;
        break;
      default:
        nextHandler = null;
        break;
    }
    if (nextHandler === null) {
      return session.nodes[session.nodes.length - 1];
    }
    const node = createNode(session, {
      nodeAction: action,
      userInput: userInput,
      message: message,
      nextHandler: nextHandler,
    });
    return Promise.resolve(node);
  }
}

@Injectable()
export class NameEnteredHandler implements ChatHandler {
  async execute(userInput: string, session: ChatSession): Promise<ChatNode> {
    const nameIsValid = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/.test(
      userInput,
    );
    if (nameIsValid) {
      session.metaData = { ...session.metaData, [fieldNames.name]: userInput };
      const node = createNode(session, {
        nodeAction: ChatAction.Prompt,
        userInput: userInput,
        message: `
        Where do you stay?
        `,
        nextHandler: AddressEnteredHandler.name,
      });
      return Promise.resolve(node);
    } else {
      // stay on the name node
      const node = session.nodes[session.nodes.length - 1];
      node.hasError = true;
      return Promise.resolve(node);
    }
  }
}

@Injectable()
export class AddressEnteredHandler implements ChatHandler {
  async execute(userInput: string, session: ChatSession): Promise<ChatNode> {
    const addressIsValid = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/.test(
      userInput,
    );
    if (addressIsValid) {
      session.metaData = {
        ...session.metaData,
        [fieldNames.address]: userInput,
      };
      await this.submitToGoogleSheet(session);
      const node = createNode(session, {
        nodeAction: ChatAction.End,
        userInput: userInput,
        message: `
        Thank you for contacting us. We will call you shortly.
        `,
        nextHandler: "",
      });
      return Promise.resolve(node);
    } else {
      // stay on the address node
      const node = session.nodes[session.nodes.length - 1];
      node.hasError = true;
      return Promise.resolve(node);
    }
  }

  private async submitToGoogleSheet(session: ChatSession): Promise<void> {
    //TODO submit to crm
    // refer to https://developers.google.com/sheets/api/quickstart/nodejs
    console.log("submit to crm", session.metaData);
    return await Promise.resolve();
  }
}
