import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import { AppConfigService } from '../config/app-config.service'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = request.headers['x-admin-secret']
    if (typeof secret !== 'string' || !this.constantTimeEqual(secret, this.appConfig.adminSecret)) {
      throw new UnauthorizedException('Invalid admin secret')
    }
    return true
  }

  /**
   * Constant-time comparison that does not leak string length.
   * Both inputs are hashed to a fixed 32-byte digest before comparison.
   */
  private constantTimeEqual(a: string, b: string): boolean {
    const ha = createHmac('sha256', 'admin-guard').update(a).digest()
    const hb = createHmac('sha256', 'admin-guard').update(b).digest()
    return timingSafeEqual(ha, hb)
  }
}
