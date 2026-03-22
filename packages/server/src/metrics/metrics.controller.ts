import { Controller, Get, Req, Res, ForbiddenException } from '@nestjs/common'
import { ApiExcludeEndpoint } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client'
import { AppConfigService } from '../config/app-config.service'

@Controller()
export class MetricsController {
  private readonly register: Registry
  private readonly httpRequests: Counter
  private readonly httpDuration: Histogram

  constructor(private readonly appConfig: AppConfigService) {
    this.register = new Registry()
    collectDefaultMetrics({ register: this.register })

    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    })

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register],
    })
  }

  @Get('metrics')
  @ApiExcludeEndpoint()
  async metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const allowedIPs = this.appConfig.metricsAllowedIPs
    if (allowedIPs.length > 0 && !allowedIPs.includes(req.ip ?? '')) {
      throw new ForbiddenException('Metrics endpoint is restricted')
    }
    const output = await this.register.metrics()
    res.setHeader('Content-Type', this.register.contentType)
    res.send(output)
  }

  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    this.httpRequests.labels(method, path, String(status)).inc()
    this.httpDuration.labels(method, path).observe(durationMs / 1000)
  }
}
