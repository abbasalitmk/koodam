import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './database/redis.service';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';
import { AppException } from './common/utils/app.exception';
import { ErrorCode } from './common/utils/error-codes';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.get<number>('app.port', 3000);
  const apiPrefix = config.get<string>('app.apiPrefix', 'api');
  const corsOrigins = config.get<string[]>('app.corsOrigins', ['*']);

  app.setGlobalPrefix(apiPrefix, { exclude: ['health', 'health/live', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
        return new AppException(
          ErrorCode.VALIDATION_FAILED,
          messages[0] ?? 'Request validation failed',
          400,
          { fields: messages },
        );
      },
    }),
  );

  // Socket.io across multiple API instances needs the Redis adapter, otherwise
  // a message published on instance A never reaches a client held by instance B.
  const redisAdapter = new RedisIoAdapter(app, app.get(RedisService));
  await redisAdapter.connect();
  app.useWebSocketAdapter(redisAdapter);

  if (config.get<boolean>('app.swaggerEnabled', true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Koodam API')
      .setDescription(
        'Koodam (കൂടം) — Kerala-first social discovery, events and dating platform.\n\n' +
          '**Conventions**\n' +
          '- Every response is wrapped as `{ success, data, meta? }` or `{ success, error }`.\n' +
          '- Feeds use cursor pagination: pass `meta.nextCursor` back as `?cursor=`.\n' +
          '- Precise coordinates of other users are never returned; distance is coarse.\n' +
          '- Sensitive identifiers (user id, organizer id, payment state) are always derived\n' +
          '  server-side from the bearer token, never read from the request body.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addServer(config.get<string>('app.appUrl', `http://localhost:${port}`))
      .addTag('Authentication')
      .addTag('Users')
      .addTag('Profiles')
      .addTag('Interests')
      .addTag('Locations')
      .addTag('Events')
      .addTag('Event Attendees')
      .addTag('Event Chat')
      .addTag('Dating')
      .addTag('Love Requests')
      .addTag('Connections')
      .addTag('Messages')
      .addTag('Notifications')
      .addTag('Search')
      .addTag('Recommendations')
      .addTag('Featured Events')
      .addTag('Payments')
      .addTag('Media')
      .addTag('Verification')
      .addTag('Reports')
      .addTag('Blocks')
      .addTag('Privacy')
      .addTag('Admin')
      .addTag('Health')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
      customSiteTitle: 'Koodam API Reference',
    });
  }

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`Koodam API listening on http://localhost:${port}/${apiPrefix}/v1`);
  logger.log(`API reference at http://localhost:${port}/${apiPrefix}/docs`);
}

void bootstrap();
