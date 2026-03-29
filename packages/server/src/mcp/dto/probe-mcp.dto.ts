import { IsUrl, IsOptional, IsObject } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ProbeMcpDto {
  @ApiProperty({ example: 'https://mcp.example.com/sse', description: 'Server URL to test connectivity' })
  @IsUrl({ require_tld: false })
  serverUrl!: string

  @ApiPropertyOptional({ description: 'Optional HTTP headers to send with the request (e.g. for auth)' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>
}
