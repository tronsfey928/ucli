import { IsString, IsOptional, Length, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateGroupDto {
  @ApiProperty({ example: 'production', description: 'Unique group name (lowercase alphanumeric, hyphens, underscores)' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name!: string

  @ApiPropertyOptional({ example: 'Production environment agents', description: 'Optional group description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string
}
