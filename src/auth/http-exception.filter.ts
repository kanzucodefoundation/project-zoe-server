import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import ClientFriendlyException from '../shared/exceptions/client-friendly.exception';
import { QueryFailedError } from 'typeorm';

function parseValidationErrors(exception: any) {
  try {
    if (exception instanceof BadRequestException) {
      return {
        message: 'Validation Error',
        errors: exception.message,
      };
    }
  } catch (ex) {
    return {
      message: 'Validation Error',
      errorMessage: exception.message,
    };
  }
}

function handleHttpException(exception: HttpException, host: ArgumentsHost) {
  const ctx = host.switchToHttp();
  const response = ctx.getResponse<Response>();
  const request = ctx.getRequest<Request>();
  const status = exception.getStatus();
  if (exception instanceof BadRequestException) {
    const data = parseValidationErrors(exception);
    data['statusCode'] = status;
    response.status(status).json(data);
    return;
  }
  if (exception instanceof ClientFriendlyException) {
    response.status(HttpStatus.BAD_REQUEST).json({
      message: exception.getResponse(),
    });
    return;
  }
  if (exception instanceof QueryFailedError) {
    response.status(HttpStatus.BAD_REQUEST).json({
      message: exception.getResponse(),
    });
    return;
  }
  response.status(status).json({
    statusCode: status,
    timestamp: new Date().toISOString(),
    path: request.url,
  });
}

function handleQueryFailedError(
  exception: QueryFailedError,
  host: ArgumentsHost,
) {
  const ctx = host.switchToHttp();
  const response = ctx.getResponse<Response>();
  const request = ctx.getRequest<Request>();
  let status = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';
  if (exception['code'] === 'ER_DUP_ENTRY') {
    message = 'Duplicate entry, please check input';
    status = HttpStatus.BAD_REQUEST;
  }
  if (exception['code'] === '23503') {
    // pg only
    message = 'Data integrity error, please check input';
    status = HttpStatus.BAD_REQUEST;
  }
  response.status(status).json({
    statusCode: status,
    timestamp: new Date().toISOString(),
    path: request.url,
    message,
  });
}

@Catch(Error)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    console.log(exception);
    Logger.error('Internal error', JSON.stringify(exception));
    if (exception instanceof HttpException) {
      return handleHttpException(exception, host);
    }

    if (exception instanceof QueryFailedError) {
      return handleQueryFailedError(exception, host);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof ClientFriendlyException) {
      response.status(HttpStatus.BAD_REQUEST).json({
        message: exception.getResponse(),
      });
      return;
    }
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Internal server error',
    });
  }
}
