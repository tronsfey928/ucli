import { Controller, Get, Inject } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus'
import { CACHE_ADAPTER } from '../cache/cache.token'
import type { ICacheAdapter } from '../cache/cache.interface'

@ApiTags('Health')
@Controller('api/v1')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(CACHE_ADAPTER) private readonly cache: ICacheAdapter,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  readiness() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.cache.has('__readycheck__')
          return { cache: { status: 'up' } }
        } catch (err) {
          return { cache: { status: 'down', message: (err as Error).message } }
        }
      },
    ])
  }
}
