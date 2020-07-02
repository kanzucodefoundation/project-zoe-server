import { HttpException, HttpStatus } from '@nestjs/common';

export default class ClientFriendlyException extends HttpException {
  constructor(response: string | object, status: number = HttpStatus.BAD_REQUEST) {
    super(response, status);
  }
}
