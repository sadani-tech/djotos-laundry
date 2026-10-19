import './env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Djotos').log(`API berjalan di http://localhost:${port}/api`);
}
bootstrap();
