import { IsString, IsUUID, IsEnum, IsOptional, IsUrl, Length, Matches, IsObject } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { McpAuthConfig } from '../../storage/interfaces/repos.interface'

export class CreateMcpDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'ID of the group this MCP server belongs to', format: 'uuid' })
  @IsUUID()
  groupId!: string

  @ApiProperty({ example: 'my-mcp-server', description: 'Unique server name (lowercase alphanumeric, hyphens)' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name!: string

  @ApiPropertyOptional({ example: 'My MCP server description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @ApiProperty({ example: 'http', enum: ['http', 'stdio'], description: 'Transport type' })
  @IsEnum(['http', 'stdio'])
  transport!: 'http' | 'stdio'

  @ApiPropertyOptional({ example: 'https://mcp.example.com/sse', description: 'Server URL (required for http transport)' })
  @IsOptional()
  @IsUrl()
  serverUrl?: string

  @ApiPropertyOptional({ example: 'npx -y my-mcp-server', description: 'Command to run (required for stdio transport)' })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  command?: string

  @ApiProperty({
    description: 'Auth config (shape varies by auth type)',
    examples: {
      none: { value: { type: 'none' } },
      http_headers: { value: { type: 'http_headers', headers: { Authorization: 'Bearer my-token' } } },
      env: { value: { type: 'env', env: { API_KEY: 'my-api-key' } } },
    },
  })
  @IsObject()
  authConfig!: McpAuthConfig
}
