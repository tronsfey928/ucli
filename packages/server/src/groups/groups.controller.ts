import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { AdminGuard } from '../auth/admin.guard'
import { GroupsService } from './groups.service'
import { CreateGroupDto } from './dto/create-group.dto'

@Controller('admin/groups')
@UseGuards(AdminGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create({ name: dto.name, description: dto.description ?? '' })
  }

  @Get()
  findAll() {
    return this.groupsService.findAll()
  }
}
