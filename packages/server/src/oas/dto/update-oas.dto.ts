import { IsString, IsUrl, IsEnum, IsOptional, IsInt, IsBoolean, Min, Length, IsObject } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import type { AuthType, AuthConfig } from '../../storage/interfaces/repos.interface'

export class UpdateOASDto {
  @ApiPropertyOptional({ example: 'payments-v2', description: 'Updated service name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string

  @ApiPropertyOptional({ example: 'Updated description', description: 'Updated description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @ApiPropertyOptional({ example: 'https://api.example.com/v2/openapi.json', description: 'Updated remote URL' })
  @IsOptional()
  @IsUrl()
  remoteUrl?: string

  @ApiPropertyOptional({ example: 'https://api.example.com/v2', description: 'Updated base endpoint (null to clear)' })
  @IsOptional()
  @IsUrl()
  baseEndpoint?: string | null

  @ApiPropertyOptional({ example: 'api_key', enum: ['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'] })
  @IsOptional()
  @IsEnum(['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'])
  authType?: AuthType

  @ApiPropertyOptional({ description: 'Updated auth config (will be re-encrypted)' })
  @IsOptional()
  @IsObject()
  authConfig?: AuthConfig

  @ApiPropertyOptional({ example: 7200, description: 'Updated cache TTL in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cacheTtl?: number

  @ApiPropertyOptional({ example: false, description: 'Enable or disable this OAS entry' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
