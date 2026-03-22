import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { Request } from 'express'
import { JwtService } from '../crypto/jwt.service'
import { CACHE_ADAPTER } from '../cache/cache.token'
import type { ICacheAdapter } from '../cache/cache.interface'
import type { JwtPayload } from '../crypto/jwt.service'

export const JWT_PAYLOAD_KEY = '__jwtPayload'
const BLACKLIST_PREFIX = 'jti:blacklist:'

@Injectable()
export class GroupTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CACHE_ADAPTER) private readonly cache: ICacheAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required')
    }

    const token = authHeader.slice(7)

    const payload = await this.jwtService.verify(token).catch(() => {
      throw new UnauthorizedException('Invalid or expired token')
    })

    const blacklisted = await this.cache.has(`${BLACKLIST_PREFIX}${payload.jti}`)
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked')
    }

    // Attach payload to request for use in controllers
    (request as unknown as Record<string, unknown>)[JWT_PAYLOAD_KEY] = payload
    return true
  }
}
