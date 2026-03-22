import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { GroupTokenGuard } from '../auth/group-token.guard'
import { JwtPayloadParam } from '../auth/decorators/jwt-payload.decorator'
import type { JwtPayload } from '../crypto/jwt.service'
import { OASService } from './oas.service'

@Controller('api/v1/oas')
@UseGuards(GroupTokenGuard)
export class ClientOASController {
  constructor(private readonly oasService: OASService) {}

  @Get()
  findByGroup(@JwtPayloadParam() payload: JwtPayload) {
    return this.oasService.findByGroup(payload.sub)
  }

  @Get(':name')
  findByName(@Param('name') name: string, @JwtPayloadParam() payload: JwtPayload) {
    return this.oasService.findByName(name, payload.sub)
  }
}
