import { IsString, IsOptional, Length, Matches } from 'class-validator'

export class CreateGroupDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9\-_]+$/, { message: 'name must be lowercase alphanumeric with hyphens/underscores' })
  name!: string

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string
}
