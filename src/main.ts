import './dns-fix';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { MongooseExceptionFilter } from './common/filters/mongoose-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  // Serve uploaded images statically at /uploads (outside the /api prefix,
  // matching the paths stored on User/Post documents e.g. "/uploads/x.png").
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new MongooseExceptionFilter());

  // CLIENT_URL is a comma separated list of allowed origins; `*` in an entry
  // matches letters, digits and dashes (never a dot), so one entry can cover every Vercel preview
  // deployment, e.g. https://facebook-prototype-frontend*.vercel.app
  // (A bare `*` origin can't be used: browsers reject it with credentials.)
  const allowedOrigins = (configService.get<string>('CLIENT_URL') || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((origin) =>
      origin.includes('*')
        ? new RegExp(`^${origin.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]*')}$`, 'i')
        : origin,
    );
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Render injects PORT at runtime; 5000 is the local default.
  const port = Number(process.env.PORT) || 5000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
