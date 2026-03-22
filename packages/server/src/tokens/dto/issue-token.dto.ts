import { IsString, IsOptional, IsArray, IsInt, Length, Min } from 'class-validator'

export class IssueTokenDto {
  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  ttlSec?: number
}
