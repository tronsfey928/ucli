import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { Logger } from '@nestjs/common'
import { Logger as PinoLogger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AppConfigService } from './config/app-config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(PinoLogger))

  // Security
  app.use(helmet())
  app.enableCors({ origin: process.env['NODE_ENV'] !== 'production' })

  const cfg = app.get(AppConfigService)

  // Graceful shutdown
  app.enableShutdownHooks()

  await app.listen(cfg.port, cfg.host)

  const logger = new Logger('Bootstrap')
  logger.log(`Server running on http://${cfg.host}:${cfg.port}`)
  logger.log(`Storage: ${cfg.dbType} | Cache: ${cfg.cacheType} | Env: ${cfg.nodeEnv}`)
}

void bootstrap()
