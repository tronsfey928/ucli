import { IsString, IsUrl, IsEnum, IsOptional, IsInt, IsBoolean, Min, Length, IsObject } from 'class-validator'
import type { AuthType, AuthConfig } from '../../storage/interfaces/repos.interface'

export class UpdateOASDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string

  @IsOptional()
  @IsUrl()
  remoteUrl?: string

  @IsOptional()
  @IsUrl()
  baseEndpoint?: string | null

  @IsOptional()
  @IsEnum(['bearer', 'api_key', 'basic', 'oauth2_cc', 'none'])
  authType?: AuthType

  @IsOptional()
  @IsObject()
  authConfig?: AuthConfig

  @IsOptional()
  @IsInt()
  @Min(0)
  cacheTtl?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
