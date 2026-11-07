import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadFileSecrets } from './config/env';

async function bootstrap() {
  // Pull any `<NAME>_FILE` secrets into the environment before AppModule validates it.
  loadFileSecrets();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  // FRONTEND_URL is required at startup (see config/env.ts), so this is never an open "allow all".
  app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}
bootstrap();
