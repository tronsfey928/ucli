import { DynamicModule, Logger, Module } from '@nestjs/common'
import { AppConfigService } from '../config/app-config.service'
import { CACHE_ADAPTER } from './cache.token'
import { MemoryCacheAdapter } from './memory/memory-cache.adapter'
import { RedisCacheAdapter } from './redis/redis-cache.adapter'

const logger = new Logger('CacheModule')

@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    const cacheType = (process.env['CACHE_TYPE'] ?? 'memory') as 'memory' | 'redis'

    if (cacheType === 'memory') {
      logger.log('Cache adapter: memory')
      return {
        global: true,
        module: CacheModule,
        providers: [
          MemoryCacheAdapter,
          { provide: CACHE_ADAPTER, useExisting: MemoryCacheAdapter },
        ],
        exports: [CACHE_ADAPTER],
      }
    }

    logger.log('Cache adapter: redis')
    return {
      global: true,
      module: CacheModule,
      providers: [
        {
          provide: RedisCacheAdapter,
          inject: [AppConfigService],
          useFactory: async (cfg: AppConfigService) => {
            const adapter = new RedisCacheAdapter(cfg.redisUrl!)
            await adapter.connect()
            return adapter
          },
        },
        { provide: CACHE_ADAPTER, useExisting: RedisCacheAdapter },
      ],
      exports: [CACHE_ADAPTER],
    }
  }
}
