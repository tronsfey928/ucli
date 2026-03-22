import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import * as Joi from 'joi'
import { AppConfigService } from './app-config.service'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        HOST: Joi.string().default('0.0.0.0'),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

        ADMIN_SECRET: Joi.string().min(8).required(),

        JWT_PRIVATE_KEY: Joi.string().optional(),
        JWT_PUBLIC_KEY: Joi.string().optional(),
        JWT_DEFAULT_TTL: Joi.number().default(86400),

        DB_TYPE: Joi.string().valid('memory', 'postgres', 'mysql').default('memory'),
        DATABASE_URL: Joi.when('DB_TYPE', {
          is: Joi.valid('postgres', 'mysql'),
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),

        CACHE_TYPE: Joi.string().valid('memory', 'redis').default('memory'),
        REDIS_URL: Joi.when('CACHE_TYPE', {
          is: 'redis',
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),

        ENCRYPTION_KEY: Joi.string()
          .pattern(/^[0-9a-f]{64}$/)
          .required()
          .messages({ 'string.pattern.base': 'ENCRYPTION_KEY must be a 64-char hex string' }),

        RATE_LIMIT_TTL: Joi.number().default(60000),
        RATE_LIMIT_LIMIT: Joi.number().default(100),

        METRICS_ALLOWED_IPS: Joi.string().default('127.0.0.1,::1'),
        LOG_LEVEL: Joi.string()
          .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
          .default('info'),
      }),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
