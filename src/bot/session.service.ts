import { Inject, Injectable } from "@nestjs/common";
import { Connection, Repository } from "typeorm";
import { ChatSession } from "./entities/chat-session.entity";
import { ChatNode } from "./entities/chat-node.entity";
import { ChatAction } from "./dto/ussd-response.dto";
import { UssdRequestDto } from "./dto/ussd-request.dto";

@Injectable()
export class SessionService {
  private readonly sessionRepository: Repository<ChatSession>;
  private readonly chatNodeRepository: Repository<ChatNode>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.sessionRepository = connection.getRepository(ChatSession);
    this.chatNodeRepository = connection.getRepository(ChatNode);
  }

  async loadSession(request: UssdRequestDto): Promise<ChatSession> {
    let session = await this.sessionRepository.findOne({
      where: [{ sessionId: request.sessionId, isActive: true }],
      relations: ["nodes"],
    });
    if (!session) {
      session = this.sessionRepository.create({
        phone: request.phoneNumber,
        sessionId: request.sessionId,
        userPath: `start=>${request.text}`,
        isActive: true,
        language: "en",
        nodes: [],
        metaData: {},
      });

      await this.sessionRepository.save(session);
    }

    return session;
  }

  async createNode(node: ChatNode): Promise<ChatNode> {
    const newNode = this.chatNodeRepository.create(node);
    await this.chatNodeRepository.save(newNode);
    return newNode;
  }

  async updateSession(session: ChatSession, node: ChatNode): Promise<void> {
    const foundSession = await this.sessionRepository.findOne({
      where: { id: session.id },
    });
    if (!foundSession) {
      throw new Error(`Session not found ${session.id}`);
    }
    foundSession.metaData = session.metaData;
    foundSession.isActive = node.nodeAction === ChatAction.Prompt;
    foundSession.userPath = `${session.userPath}=>${node.userInput}`;
    await this.sessionRepository.save(foundSession);
    const newNode = this.chatNodeRepository.create(node);
    await this.chatNodeRepository.save(newNode);
  }

  /*
   * Pop the last node from the session and return the new last node
   */
  async popChatNode(session: ChatSession): Promise<ChatNode> {
    if (session.nodes.length === 1) {
      return session.nodes[0];
    }

    const poppedNode = session.nodes.pop();
    await this.chatNodeRepository.delete(poppedNode.id);

    session.userPath += `=>${session.userPath}`;
    await this.sessionRepository.save(session);
    return session.nodes[session.nodes.length - 1];
  }
}
