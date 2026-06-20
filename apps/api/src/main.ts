import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { static as serveStaticAssets } from 'express';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadsDirectory =
    process.env.UPLOADS_DIRECTORY ?? join(__dirname, '..', 'uploads');

  mkdirSync(uploadsDirectory, { recursive: true });
  app.use('/uploads', serveStaticAssets(uploadsDirectory));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // 1. Build the OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Raffle Royale API')
    .setDescription('The Raffle Royale API description')
    .setVersion('1.0')
    .addTag('raffle')
    .build();

  // 2. Create the OpenAPI document object
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      controllerKey.replace('Controller', '') +
      methodKey.charAt(0).toUpperCase() +
      methodKey.slice(1),
  });

  // Optional: Save the JSON specification locally on server start
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

  // 3. Setup the interactive UI and endpoints
  // By default, this creates '/api' for UI and '/api-json' for raw JSON
  SwaggerModule.setup('docs', app, document);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
