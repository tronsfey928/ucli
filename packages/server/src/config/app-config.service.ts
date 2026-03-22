import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get port(): number { return this.config.get<number>('PORT', 3000) }
  get host(): string { return this.config.get<string>('HOST', '0.0.0.0') }
  get nodeEnv(): string { return this.config.get<string>('NODE_ENV', 'development') }
  get isDev(): boolean { return this.nodeEnv === 'development' }
  get isProd(): boolean { return this.nodeEnv === 'production' }

  get adminSecret(): string { return this.config.getOrThrow<string>('ADMIN_SECRET') }
  get encryptionKey(): string { return this.config.getOrThrow<string>('ENCRYPTION_KEY') }

  get jwtPrivateKey(): string | undefined { return this.config.get<string>('JWT_PRIVATE_KEY') }
  get jwtPublicKey(): string | undefined { return this.config.get<string>('JWT_PUBLIC_KEY') }
  get jwtDefaultTtl(): number { return this.config.get<number>('JWT_DEFAULT_TTL', 86400) }

  get dbType(): 'memory' | 'postgres' | 'mysql' {
    return this.config.get<'memory' | 'postgres' | 'mysql'>('DB_TYPE', 'memory')
  }
  get databaseUrl(): string | undefined { return this.config.get<string>('DATABASE_URL') }

  get cacheType(): 'memory' | 'redis' {
    return this.config.get<'memory' | 'redis'>('CACHE_TYPE', 'memory')
  }
  get redisUrl(): string | undefined { return this.config.get<string>('REDIS_URL') }

  get rateLimitTtl(): number { return this.config.get<number>('RATE_LIMIT_TTL', 60000) }
  get rateLimitLimit(): number { return this.config.get<number>('RATE_LIMIT_LIMIT', 100) }

  get metricsAllowedIPs(): string[] {
    return this.config.get<string>('METRICS_ALLOWED_IPS', '127.0.0.1,::1').split(',').map(s => s.trim())
  }
  get logLevel(): string { return this.config.get<string>('LOG_LEVEL', 'info') }
}
