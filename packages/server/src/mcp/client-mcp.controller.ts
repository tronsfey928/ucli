import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GroupTokenGuard } from '../auth/group-token.guard'
import { JwtPayloadParam } from '../auth/decorators/jwt-payload.decorator'
import type { JwtPayload } from '../crypto/jwt.service'
import type { McpEntry } from '../storage/interfaces/repos.interface'
import { MCPService } from './mcp.service'
import { PaginationQueryDto, paginate } from '../common'

@ApiTags('Client / MCP')
@ApiBearerAuth('GroupJWT')
@Controller('api/v1/mcp')
@UseGuards(GroupTokenGuard)
export class ClientMCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get()
  @ApiOperation({ summary: 'List MCP servers for the authenticated group (credentials redacted)' })
  @ApiResponse({ status: 200, description: 'List of MCP servers with authConfig redacted to type only' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async findByGroup(@JwtPayloadParam() payload: JwtPayload, @Query() query: PaginationQueryDto) {
    const entries = await this.mcpService.findByGroup(payload.sub)
    const redacted = entries.map((e) => ClientMCPController.redact(e))
    if (query.page != null || query.limit != null) {
      return paginate(redacted, query)
    }
    return redacted
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get a single MCP server by name (with decrypted auth)' })
  @ApiResponse({ status: 200, description: 'MCP server with decrypted auth config' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'MCP server not found' })
  findByName(@Param('name') name: string, @JwtPayloadParam() payload: JwtPayload) {
    return this.mcpService.findByName(name, payload.sub)
  }

  /** Strip credential values from authConfig — only expose { type } for discovery. */
  private static redact(entry: McpEntry): Omit<McpEntry, 'authConfig'> & { authConfig: { type: string } } {
    return { ...entry, authConfig: { type: entry.authConfig.type } }
  }
}
