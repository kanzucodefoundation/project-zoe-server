import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException, HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { Request, Response } from 'express';
import ClientFriendlyException from '../shared/exceptions/client-friendly.exception';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    if (exception instanceof BadRequestException) {
      const data = this.parseValidationErrors(exception);
      data['statusCode'] = status;
      response
        .status(status)
        .json(data);
      return;
    }
    if (exception instanceof ClientFriendlyException) {
      response
        .status(HttpStatus.BAD_REQUEST)
        .json({
          message: exception.getResponse(),
        });
      return;
    }
    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }

  parseValidationErrors(exception: any) {
    try {
      if (exception instanceof BadRequestException) {
        const msg: ValidationError[] = exception.message.message;
        return {
          message: 'Validation Error',
          errors: msg.map(it => Object.values(it.constraints)[0]),
        };
      }
    } catch (ex) {
      return {
        message: 'Validation Error',
        errorMessage: exception.message,
      };
    }
  }
}



