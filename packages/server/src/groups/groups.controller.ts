import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AdminGuard } from '../auth/admin.guard'
import { GroupsService } from './groups.service'
import { CreateGroupDto } from './dto/create-group.dto'
import { PaginationQueryDto, paginate } from '../common'

@ApiTags('Admin / Groups')
@ApiSecurity('AdminSecret')
@Controller('admin/groups')
@UseGuards(AdminGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 409, description: 'Group name already exists' })
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create({ name: dto.name, description: dto.description ?? '' })
  }

  @Get()
  @ApiOperation({ summary: 'List all groups (supports optional pagination via ?page=&limit=)' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async findAll(@Query() query: PaginationQueryDto) {
    const all = await this.groupsService.findAll()
    if (query.page != null || query.limit != null) {
      return paginate(all, query)
    }
    return all
  }
}
