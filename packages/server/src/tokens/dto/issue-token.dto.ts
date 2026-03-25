import { IsString, IsOptional, IsArray, IsInt, Length, Min, ArrayMaxSize } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class IssueTokenDto {
  @ApiProperty({ example: 'agent-prod', description: 'Human-readable token label' })
  @IsString()
  @Length(1, 200)
  name!: string

  @ApiPropertyOptional({ example: ['oas:read', 'mcp:read'], description: 'Token scopes (optional)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  scopes?: string[]

  @ApiPropertyOptional({ example: 86400, description: 'Token TTL in seconds (0 or omit = no expiry)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ttlSec?: number
}
