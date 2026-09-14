import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';

let cachedServer: express.Express;

async function bootstrapServer(): Promise<express.Express> {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      bufferLogs: true,
    });

    app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready', ''] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(compression());
    app.enableCors({ origin: true, credentials: true });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Koodam API (കൂടം)')
      .setDescription(
        'Koodam — Hyperlocal social discovery, events and intentional dating platform for Kerala and the Malayali diaspora.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
      customSiteTitle: 'Koodam API Reference',
    });

    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  try {
    // If Vercel rewrote the URL, preserve the original request path
    const matchedPath = req.headers['x-matched-path'];
    if (matchedPath && typeof matchedPath === 'string') {
      req.url = matchedPath;
    }

    const server = await bootstrapServer();
    return server(req, res);
  } catch (err: any) {
    console.error('Koodam serverless bootstrap error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INITIALIZATION_ERROR',
        message: err?.message || 'Serverless bootstrap error',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
