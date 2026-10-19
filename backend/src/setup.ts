import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters';

/** Pengaturan yang dipakai bersama oleh aplikasi dan e2e test. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), exposedHeaders: ['Content-Disposition'] });
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // Tampilkan satu pesan ramah (bukan daftar teknis).
      exceptionFactory: (errors: ValidationError[]) => {
        const first = errors.flatMap((e) => Object.values(e.constraints ?? {}).concat(e.children?.flatMap((c) => Object.values(c.constraints ?? {})) ?? []))[0];
        return new BadRequestException(first ?? 'Data yang dikirim tidak valid');
      },
    }),
  );
}
