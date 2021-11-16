// import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

// @WebSocketGateway()
// export class ChatGateway {
//   @SubscribeMessage('message')
//   handleMessage(client: any, payload: any): string {
//     return 'Hello world!';
//   }
// }

import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {map}  from 'rxjs/operators'
// import { MessagesserviceService } from './messagesservice/messages/messagesservice.service';

@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // constructor(private  messagesserviceService : MessagesserviceService ){}
  private logger: Logger = new Logger('ChatGateway');

  @SubscribeMessage('msgToServer')
  handleMessage(client: Socket, payload: string): void {
    // this.messagesserviceService.addMessage( payload, client.id)
    console.log(payload,"Message sent")
    this.logger.log(`Message sent: ${payload}`)
    this.server.emit('msgToClient', payload, client.id);

  }

  afterInit(server: Server) {
    this.logger.log('Init');
  }

  handleConnection(client: Socket) {
    // this.messagesserviceService.addClient(client.id)
    this.logger.log( `Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log( `Client disconnected: ${client.id}`);
  }
} 