import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GroupTokenGuard } from '../auth/group-token.guard'
import { JwtPayloadParam } from '../auth/decorators/jwt-payload.decorator'
import type { JwtPayload } from '../crypto/jwt.service'
import type { OASEntry } from '../storage/interfaces/repos.interface'
import { OASService } from './oas.service'

@ApiTags('Client / OAS')
@ApiBearerAuth('GroupJWT')
@Controller('api/v1/oas')
@UseGuards(GroupTokenGuard)
export class ClientOASController {
  constructor(private readonly oasService: OASService) {}

  @Get()
  @ApiOperation({ summary: 'List OAS entries for the authenticated group (credentials redacted)' })
  @ApiResponse({ status: 200, description: 'List of OAS entries with authConfig redacted to type only' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async findByGroup(@JwtPayloadParam() payload: JwtPayload) {
    const entries = await this.oasService.findByGroup(payload.sub)
    return entries.map((e) => ClientOASController.redact(e))
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get a single OAS entry by service name (with decrypted auth)' })
  @ApiResponse({ status: 200, description: 'OAS entry with decrypted auth config' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'OAS entry not found' })
  findByName(@Param('name') name: string, @JwtPayloadParam() payload: JwtPayload) {
    return this.oasService.findByName(name, payload.sub)
  }

  /** Strip credential values from authConfig — only expose { type } for discovery. */
  private static redact(entry: OASEntry): Omit<OASEntry, 'authConfig'> & { authConfig: { type: string } } {
    return { ...entry, authConfig: { type: entry.authType } }
  }
}
