import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Group, IGroupRepo, CreateGroupInput } from '../interfaces/repos.interface'

@Injectable()
export class MemoryGroupRepo implements IGroupRepo {
  private store = new Map<string, Group>()

  async create(data: CreateGroupInput): Promise<Group> {
    const now = new Date()
    const group: Group = { id: randomUUID(), name: data.name, description: data.description, createdAt: now, updatedAt: now }
    this.store.set(group.id, group)
    return group
  }

  async findAll(): Promise<Group[]> { return [...this.store.values()] }

  async findById(id: string): Promise<Group | null> { return this.store.get(id) ?? null }

  async findByName(name: string): Promise<Group | null> {
    for (const g of this.store.values()) if (g.name === name) return g
    return null
  }
}
