import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AdminGuard } from '../auth/admin.guard'
import { GroupsService } from '../groups/groups.service'
import { TokensService } from './tokens.service'
import { IssueTokenDto } from './dto/issue-token.dto'

@ApiTags('Admin / Tokens')
@ApiSecurity('AdminSecret')
@Controller('admin')
@UseGuards(AdminGuard)
export class TokensController {
  constructor(
    private readonly tokensService: TokensService,
    private readonly groupsService: GroupsService,
  ) {}

  @Get('groups/:groupId/tokens')
  @ApiOperation({ summary: 'List tokens for a group (metadata only — JWTs not stored)' })
  @ApiResponse({ status: 200, description: 'Token list' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async list(@Param('groupId') groupId: string) {
    await this.groupsService.findById(groupId) // 404 if group missing
    return this.tokensService.listByGroup(groupId)
  }

  @Post('groups/:groupId/tokens')
  @HttpCode(201)
  @ApiOperation({ summary: 'Issue a JWT token for a group' })
  @ApiResponse({ status: 201, description: 'Token issued successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async issue(@Param('groupId') groupId: string, @Body() dto: IssueTokenDto) {
    const group = await this.groupsService.findById(groupId)
    return this.tokensService.issue({
      groupId: group.id,
      groupName: group.name,
      name: dto.name,
      scopes: dto.scopes,
      ttlSec: dto.ttlSec,
    })
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a token by ID' })
  @ApiResponse({ status: 204, description: 'Token revoked' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async revoke(@Param('id') id: string): Promise<void> {
    await this.tokensService.revoke(id)
  }
}

