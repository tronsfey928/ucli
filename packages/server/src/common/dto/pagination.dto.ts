import { IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function paginate<T>(items: T[], query: PaginationQueryDto): PaginatedResponse<T> {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const total = items.length
  const totalPages = Math.ceil(total / limit) || 1
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)

  return {
    data,
    meta: { page, limit, total, totalPages },
  }
}
