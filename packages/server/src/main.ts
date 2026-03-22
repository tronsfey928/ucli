import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger } from '@nestjs/common'
import { Logger as PinoLogger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AppConfigService } from './config/app-config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(PinoLogger))

  const cfg = app.get(AppConfigService)

  // Security — disable CSP when Swagger UI is enabled (it uses inline scripts/styles)
  app.use(helmet({
    contentSecurityPolicy: cfg.swaggerEnabled ? false : undefined,
  }))
  app.enableCors({ origin: !cfg.isProd })

  // Swagger / OpenAPI
  if (cfg.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OAS Gateway API')
      .setDescription(
        'Centralized OpenAPI Specification management server.\n\n' +
        '**Admin API** — requires `X-Admin-Secret` header.\n\n' +
        '**Client API** — requires `Authorization: Bearer <group-jwt>` header.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Group JWT issued by the admin' },
        'GroupJWT',
      )
      .addApiKey(
        { type: 'apiKey', name: 'x-admin-secret', in: 'header', description: 'Admin secret (ADMIN_SECRET env var)' },
        'AdminSecret',
      )
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
      swaggerOptions: { persistAuthorization: true },
    })
  }

  // Graceful shutdown
  app.enableShutdownHooks()

  await app.listen(cfg.port, cfg.host)

  const logger = new Logger('Bootstrap')
  logger.log(`Server running on http://${cfg.host}:${cfg.port}`)
  if (cfg.swaggerEnabled) {
    logger.log(`Swagger UI: http://${cfg.host}:${cfg.port}/api/docs`)
    logger.log(`OpenAPI JSON: http://${cfg.host}:${cfg.port}/api/openapi.json`)
  }
  logger.log(`Storage: ${cfg.dbType} | Cache: ${cfg.cacheType} | Env: ${cfg.nodeEnv}`)
}

void bootstrap()
