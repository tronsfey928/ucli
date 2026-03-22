import { IsString, IsUUID, IsUrl, IsEnum, IsOptional, IsInt, Min, Length, Matches, IsObject } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { AuthType, AuthConfig } from '../../storage/interfaces/repos.interface'

export class CreateOASDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'ID of the group this OAS entry belongs to', format: 'uuid' })
  @IsUUID()
  groupId!: string

  @ApiProperty({ example: 'payments', description: 'Unique service name (lowercase alphanumeric, hyphens, underscores)' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name!: string

  @ApiPropertyOptional({ example: 'Payments service OpenAPI spec', description: 'Optional description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @ApiProperty({ example: 'https://api.example.com/openapi.json', description: 'URL to the remote OpenAPI spec' })
  @IsUrl()
  remoteUrl!: string

  @ApiPropertyOptional({ example: 'https://api.example.com', description: 'Base endpoint override (optional)' })
  @IsOptional()
  @IsUrl()
  baseEndpoint?: string

  @ApiProperty({ example: 'bearer', enum: ['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'], description: 'Auth type for the upstream API' })
  @IsEnum(['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'])
  authType!: AuthType

  @ApiProperty({
    description: 'Auth config (shape varies by authType)',
    examples: {
      none: { value: { type: 'none' } },
      bearer: { value: { type: 'bearer', token: 'my-api-token' } },
      api_key: { value: { type: 'api_key', key: 'my-key', in: 'header', name: 'X-API-Key' } },
      basic: { value: { type: 'basic', username: 'user', password: 'pass' } },
      oauth2_cc: { value: { type: 'oauth2_cc', tokenUrl: 'https://auth.example.com/token', clientId: 'id', clientSecret: 'secret', scopes: [] } },
    },
  })
  @IsObject()
  authConfig!: AuthConfig

  @ApiPropertyOptional({ example: 3600, description: 'Cache TTL in seconds for CLI local cache (0 = no cache)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cacheTtl?: number
}
