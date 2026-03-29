import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AdminGuard } from '../auth/admin.guard'
import { OASService } from './oas.service'
import { CreateOASDto } from './dto/create-oas.dto'
import { UpdateOASDto } from './dto/update-oas.dto'
import { ProbeOASDto } from './dto/probe-oas.dto'
import { PaginationQueryDto, paginate } from '../common'

@ApiTags('Admin / OAS')
@ApiSecurity('AdminSecret')
@Controller('admin/oas')
@UseGuards(AdminGuard)
export class AdminOASController {
  constructor(private readonly oasService: OASService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new OAS entry' })
  @ApiResponse({ status: 201, description: 'OAS entry created' })
  @ApiResponse({ status: 409, description: 'Service name already exists in this group' })
  create(@Body() dto: CreateOASDto) {
    return this.oasService.create({
      groupId: dto.groupId,
      name: dto.name,
      description: dto.description ?? '',
      remoteUrl: dto.remoteUrl,
      baseEndpoint: dto.baseEndpoint,
      authType: dto.authType,
      authConfig: dto.authConfig,
      cacheTtl: dto.cacheTtl,
    })
  }

  @Get()
  @ApiOperation({ summary: 'List all OAS entries (supports optional pagination via ?page=&limit=)' })
  @ApiResponse({ status: 200, description: 'List of OAS entries' })
  async findAll(@Query() query: PaginationQueryDto) {
    const all = await this.oasService.findAll()
    if (query.page != null || query.limit != null) {
      return paginate(all, query)
    }
    return all
  }

  @Post('probe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fetch and parse a remote OpenAPI spec to preview endpoints' })
  @ApiResponse({ status: 200, description: 'Parsed OpenAPI spec info' })
  @ApiResponse({ status: 400, description: 'Failed to fetch or parse the spec' })
  probe(@Body() dto: ProbeOASDto) {
    return this.oasService.probe(dto.url, dto.headers)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an OAS entry' })
  @ApiResponse({ status: 200, description: 'OAS entry updated' })
  @ApiResponse({ status: 404, description: 'OAS entry not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOASDto) {
    return this.oasService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an OAS entry' })
  @ApiResponse({ status: 204, description: 'OAS entry deleted' })
  @ApiResponse({ status: 404, description: 'OAS entry not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.oasService.delete(id)
  }
}
