import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GroupEntity } from './entities/group.entity'
import type { Group, IGroupRepo, CreateGroupInput } from '../interfaces/repos.interface'

function toGroup(e: GroupEntity): Group {
  return { id: e.id, name: e.name, description: e.description, createdAt: e.createdAt, updatedAt: e.updatedAt }
}

@Injectable()
export class TypeORMGroupRepo implements IGroupRepo {
  constructor(@InjectRepository(GroupEntity) private readonly repo: Repository<GroupEntity>) {}

  async create(data: CreateGroupInput): Promise<Group> {
    const entity = this.repo.create(data)
    return toGroup(await this.repo.save(entity))
  }

  async findAll(): Promise<Group[]> {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toGroup)
  }

  async findById(id: string): Promise<Group | null> {
    const e = await this.repo.findOneBy({ id })
    return e ? toGroup(e) : null
  }

  async findByName(name: string): Promise<Group | null> {
    const e = await this.repo.findOneBy({ name })
    return e ? toGroup(e) : null
  }
}
