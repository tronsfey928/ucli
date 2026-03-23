import { Module, ValidationPipe } from '@nestjs/common'
import { APP_PIPE, APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { AppConfigModule } from './config/app-config.module'
import { AppConfigService } from './config/app-config.service'
import { StorageModule } from './storage/storage.module'
import { CacheModule } from './cache/cache.module'
import { CryptoModule } from './crypto/crypto.module'
import { AuthModule } from './auth/auth.module'
import { GroupsModule } from './groups/groups.module'
import { TokensModule } from './tokens/tokens.module'
import { OASModule } from './oas/oas.module'
import { MCPModule } from './mcp/mcp.module'
import { HealthModule } from './health/health.module'
import { MetricsModule } from './metrics/metrics.module'

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        pinoHttp: {
          level: cfg.logLevel,
          transport: cfg.isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
        },
      }),
    }),
    StorageModule.forRoot(),
    CacheModule.forRoot(),
    CryptoModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        throttlers: [{ ttl: cfg.rateLimitTtl, limit: cfg.rateLimitLimit }],
      }),
    }),
    GroupsModule,
    TokensModule,
    OASModule,
    MCPModule,
    HealthModule,
    MetricsModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
