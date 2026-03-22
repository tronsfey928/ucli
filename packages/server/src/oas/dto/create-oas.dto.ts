import { IsString, IsUUID, IsUrl, IsEnum, IsOptional, IsInt, Min, Length, Matches, ValidateNested, IsObject } from 'class-validator'
import { Type } from 'class-transformer'
import type { AuthType, AuthConfig } from '../../storage/interfaces/repos.interface'

export class CreateOASDto {
  @IsUUID()
  groupId!: string

  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name!: string

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @IsUrl()
  remoteUrl!: string

  @IsOptional()
  @IsUrl()
  baseEndpoint?: string

  @IsEnum(['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'])
  authType!: AuthType

  @IsObject()
  authConfig!: AuthConfig

  @IsOptional()
  @IsInt()
  @Min(0)
  cacheTtl?: number
}
