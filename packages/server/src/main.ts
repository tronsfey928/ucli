#!/usr/bin/env node
// OpenTelemetry MUST be initialized before any other imports so that
// auto-instrumentation can patch modules (http, express, pg, ioredis…)
import './otel/otel'
import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger } from '@nestjs/common'
import { Logger as PinoLogger } from 'nestjs-pino'
import * as express from 'express'
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
  app.enableCors({ origin: cfg.isProd ? false : true })

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

  // Admin UI — serve the built Vite app as static files at /admin-ui
  // Checks two locations: npm dist (dist/admin-ui/) and monorepo dev (packages/admin/dist/)
  const adminUiPath = cfg.adminUiPath ?? [
    join(__dirname, 'admin-ui'),                          // npm dist
    join(__dirname, '..', '..', 'admin', 'dist'),         // monorepo ts-node-dev
  ].find(existsSync)

  if (adminUiPath && existsSync(adminUiPath)) {
    const expressApp = app.getHttpAdapter().getInstance() as express.Application
    expressApp.use('/admin-ui', express.static(adminUiPath))
    // SPA fallback — return index.html for all /admin-ui/* routes
    expressApp.get('/admin-ui/*path', (_req: express.Request, res: express.Response) => {
      res.sendFile(join(adminUiPath, 'index.html'))
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
  if (adminUiPath && existsSync(adminUiPath)) {
    logger.log(`Admin UI: http://${cfg.host}:${cfg.port}/admin-ui`)
  }
  logger.log(`Storage: ${cfg.dbType} | Cache: ${cfg.cacheType} | Env: ${cfg.nodeEnv}`)
  logger.log(`OTel: ${cfg.otelEnabled ? `enabled (endpoint=${cfg.otlpEndpoint ?? 'none (no-op)'})` : 'disabled'}`)
}

void bootstrap()
