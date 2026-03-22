import { IsString, IsOptional, IsArray, IsInt, Length, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class IssueTokenDto {
  @ApiProperty({ example: 'agent-prod', description: 'Human-readable token label' })
  @IsString()
  @Length(1, 200)
  name!: string

  @ApiPropertyOptional({ example: ['read', 'write'], description: 'Token scopes (optional)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[]

  @ApiPropertyOptional({ example: 86400, description: 'Token TTL in seconds (0 or omit = no expiry)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ttlSec?: number
}
