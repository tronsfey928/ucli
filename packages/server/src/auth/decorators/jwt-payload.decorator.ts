import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'
import { JWT_PAYLOAD_KEY } from '../group-token.guard'
import type { JwtPayload } from '../../crypto/jwt.service'

export const JwtPayloadParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request>()
    return (request as unknown as Record<string, unknown>)[JWT_PAYLOAD_KEY] as JwtPayload
  },
)
