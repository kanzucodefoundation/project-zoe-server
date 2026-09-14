import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';
import * as compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import config from './config';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './auth/http-exception.filter';
import * as Sentry from '@sentry/node';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app)); // ← add this line
  app.use(helmet());
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  app.use(compression());

  // Rate limiting runs before any body parser. Parsing first would let an
  // unauthenticated caller make the server allocate a large body on every
  // request before the limiter ever saw it.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000, // limit each IP to 100 requests per windowMs
    }),
  );

  // A reviewed import posts every parsed row back as JSON, and a few thousand
  // statement lines comfortably exceed Express's 100kb default. The allowance
  // is scoped to that one route so no other endpoint accepts a body this size;
  // the client also chunks large imports, so it is a ceiling, not the norm.
  app.use('/api/finance/transactions/import', json({ limit: '25mb' }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      //validation of all properties that are missing in the validating object
      //skipMissingProperties: true, TODO re-add this after API is cleaned up
      transform: true,
    }),
  );
  const options = new DocumentBuilder()
    .setTitle('Project Zoe API')
    .setDescription('API for Project Zoe frontend systems')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document, {});

  // Sentry Implementation
  if (process.env.APP_ENVIRONMENT === 'production') {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
    });
  }

  await app.listen(config.app.port);
}

bootstrap();
