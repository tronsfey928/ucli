import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AdminGuard } from '../auth/admin.guard'
import { MCPService } from './mcp.service'
import { CreateMcpDto } from './dto/create-mcp.dto'
import { UpdateMcpDto } from './dto/update-mcp.dto'

@ApiTags('Admin / MCP')
@ApiSecurity('AdminSecret')
@Controller('admin/mcp')
@UseGuards(AdminGuard)
export class AdminMCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new MCP server' })
  @ApiResponse({ status: 201, description: 'MCP server created' })
  @ApiResponse({ status: 409, description: 'Server name already exists' })
  create(@Body() dto: CreateMcpDto) {
    return this.mcpService.create({
      groupId: dto.groupId,
      name: dto.name,
      description: dto.description ?? '',
      transport: dto.transport,
      serverUrl: dto.serverUrl,
      command: dto.command,
      authConfig: dto.authConfig,
    })
  }

  @Get()
  @ApiOperation({ summary: 'List all MCP servers' })
  @ApiResponse({ status: 200, description: 'List of MCP servers' })
  findAll() { return this.mcpService.findAll() }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single MCP server by ID' })
  @ApiResponse({ status: 200, description: 'MCP server details' })
  @ApiResponse({ status: 404, description: 'MCP server not found' })
  findById(@Param('id') id: string) { return this.mcpService.findById(id) }

  @Put(':id')
  @ApiOperation({ summary: 'Update a MCP server' })
  @ApiResponse({ status: 200, description: 'MCP server updated' })
  @ApiResponse({ status: 404, description: 'MCP server not found' })
  update(@Param('id') id: string, @Body() dto: UpdateMcpDto) {
    return this.mcpService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a MCP server' })
  @ApiResponse({ status: 204, description: 'MCP server deleted' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.mcpService.delete(id)
  }
}
