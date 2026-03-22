import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../auth/admin.guard'
import { OASService } from './oas.service'
import { CreateOASDto } from './dto/create-oas.dto'
import { UpdateOASDto } from './dto/update-oas.dto'

@Controller('admin/oas')
@UseGuards(AdminGuard)
export class AdminOASController {
  constructor(private readonly oasService: OASService) {}

  @Post()
  @HttpCode(201)
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
  findAll() { return this.oasService.findAll() }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOASDto) {
    return this.oasService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.oasService.delete(id)
  }
}
