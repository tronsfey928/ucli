import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AdminGuard } from '../auth/admin.guard'
import { OASService } from './oas.service'
import { CreateOASDto } from './dto/create-oas.dto'
import { UpdateOASDto } from './dto/update-oas.dto'

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
  @ApiOperation({ summary: 'List all OAS entries' })
  @ApiResponse({ status: 200, description: 'List of OAS entries' })
  findAll() { return this.oasService.findAll() }

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
