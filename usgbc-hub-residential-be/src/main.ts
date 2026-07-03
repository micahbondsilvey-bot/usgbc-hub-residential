import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('app.frontendOrigin', 'http://localhost:4200'),
    credentials: true,
  });

  // Global '/api' prefix + URI versioning → '/api/v1/...'. '/health' is unversioned.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Redundant with APP_PIPE, but harmless and explicit for anyone reading main.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('USGBC Hub Residential API')
    .setDescription('GBCI Certify — LEED Residential certification platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
  logger.log(`Backend listening on http://localhost:${port} (Swagger at /api-docs)`);
}

void bootstrap();
