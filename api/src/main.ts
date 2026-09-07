import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { EnvConfig } from './common/config/env.validation';

async function bootstrap(): Promise<void> {
  // rawBody: true exposes req.rawBody (a Buffer) alongside the parsed JSON
  // body — specs/006's payment webhook (PaymentsController) needs the exact
  // raw bytes to verify Razorpay's HMAC-SHA256 signature; verifying against
  // a re-serialized JSON.stringify(req.body) would silently break the
  // moment key order or whitespace differs from what Razorpay actually sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // coding_standard.md §3: an unrecognized field in a request body is a 400,
  // not silently ignored.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // coding_standard.md §3: config via ConfigService, never process.env.X
  // scattered through business code — reads the already-validated/coerced
  // value env.validation.ts produced, not a second, differently-defaulted
  // parse of the raw env var.
  const configService = app.get(ConfigService<EnvConfig, true>);
  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`GenzFeast API listening on port ${port}`);
}

bootstrap();
