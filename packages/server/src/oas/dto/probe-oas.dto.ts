import { IsUrl, IsOptional, IsObject } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ProbeOASDto {
  @ApiProperty({ example: 'https://api.example.com/openapi.json', description: 'URL to the remote OpenAPI spec' })
  @IsUrl({ require_tld: false })
  url!: string

  @ApiPropertyOptional({ description: 'Optional HTTP headers to send with the request (e.g. for auth)' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>
}
