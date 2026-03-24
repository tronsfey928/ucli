import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'
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

  private constantTimeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      // Compare against self to keep constant time regardless of length mismatch
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  }
}
