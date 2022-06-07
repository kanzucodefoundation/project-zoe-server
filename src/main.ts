import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module";
import * as helmet from "helmet";
import * as rateLimit from "express-rate-limit";
import * as compression from "compression";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import config from "./config";
import { ValidationPipe } from "@nestjs/common";
import { HttpExceptionFilter } from "./auth/http-exception.filter";
import * as Sentry from "@sentry/node";
import { Integrations } from "@sentry/tracing";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  app.use(compression());
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
    .setTitle("Project Zoe API")
    .setDescription("API for Project Zoe frontend systems")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("docs", app, document, {});

  // Sentry Implementation
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
  });

  await app.listen(config.app.port);
}

bootstrap();
