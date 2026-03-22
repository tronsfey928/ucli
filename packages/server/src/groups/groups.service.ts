import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { GROUP_REPO } from '../storage/storage.tokens'
import type { IGroupRepo, Group, CreateGroupInput } from '../storage/interfaces/repos.interface'

@Injectable()
export class GroupsService {
  constructor(@Inject(GROUP_REPO) private readonly groupRepo: IGroupRepo) {}

  async create(data: CreateGroupInput): Promise<Group> {
    const existing = await this.groupRepo.findByName(data.name)
    if (existing) throw new ConflictException(`Group name already exists: ${data.name}`)
    return this.groupRepo.create(data)
  }

  async findAll(): Promise<Group[]> {
    return this.groupRepo.findAll()
  }

  async findById(id: string): Promise<Group> {
    const group = await this.groupRepo.findById(id)
    if (!group) throw new NotFoundException(`Group not found: ${id}`)
    return group
  }
}
