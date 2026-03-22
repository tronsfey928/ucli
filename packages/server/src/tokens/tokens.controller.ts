import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../auth/admin.guard'
import { GroupsService } from '../groups/groups.service'
import { TokensService } from './tokens.service'
import { IssueTokenDto } from './dto/issue-token.dto'

@Controller('admin')
@UseGuards(AdminGuard)
export class TokensController {
  constructor(
    private readonly tokensService: TokensService,
    private readonly groupsService: GroupsService,
  ) {}

  @Post('groups/:groupId/tokens')
  @HttpCode(201)
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
  async revoke(@Param('id') id: string): Promise<void> {
    await this.tokensService.revoke(id)
  }
}
