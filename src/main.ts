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
  // A reviewed import posts every parsed row back as JSON, and a few thousand
  // statement lines comfortably exceed Express's 100kb default. The client also
  // chunks large imports, so this is a ceiling rather than the normal size.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ limit: '25mb', extended: true }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000, // limit each IP to 100 requests per windowMs
    }),
  );
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
