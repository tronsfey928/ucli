import { IsString, IsEnum, IsOptional, IsUrl, IsBoolean, Length, Matches, IsObject } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import type { McpAuthConfig } from '../../storage/interfaces/repos.interface'

export class UpdateMcpDto {
  @ApiPropertyOptional({ example: 'my-mcp-server' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name?: string

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @ApiPropertyOptional({ enum: ['http', 'stdio'] })
  @IsOptional()
  @IsEnum(['http', 'stdio'])
  transport?: 'http' | 'stdio'

  @ApiPropertyOptional({ example: 'https://mcp.example.com/sse' })
  @IsOptional()
  @IsUrl()
  serverUrl?: string

  @ApiPropertyOptional({ example: 'npx -y my-mcp-server' })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  command?: string

  @ApiPropertyOptional({ description: 'Auth config' })
  @IsOptional()
  @IsObject()
  authConfig?: McpAuthConfig

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
