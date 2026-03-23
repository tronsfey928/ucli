import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GroupTokenGuard } from '../auth/group-token.guard'
import { JwtPayloadParam } from '../auth/decorators/jwt-payload.decorator'
import type { JwtPayload } from '../crypto/jwt.service'
import { MCPService } from './mcp.service'

@ApiTags('Client / MCP')
@ApiBearerAuth('GroupJWT')
@Controller('api/v1/mcp')
@UseGuards(GroupTokenGuard)
export class ClientMCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get()
  @ApiOperation({ summary: 'List MCP servers for the authenticated group' })
  @ApiResponse({ status: 200, description: 'List of MCP servers for the group (decrypted auth)' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  findByGroup(@JwtPayloadParam() payload: JwtPayload) {
    return this.mcpService.findByGroup(payload.sub)
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get a single MCP server by name (with decrypted auth)' })
  @ApiResponse({ status: 200, description: 'MCP server with decrypted auth config' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'MCP server not found' })
  findByName(@Param('name') name: string, @JwtPayloadParam() payload: JwtPayload) {
    return this.mcpService.findByName(name, payload.sub)
  }
}
