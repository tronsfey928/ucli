import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { AppConfigService } from '../config/app-config.service'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = request.headers['x-admin-secret']
    if (secret !== this.appConfig.adminSecret) {
      throw new UnauthorizedException('Invalid admin secret')
    }
    return true
  }
}
