import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { OASEntry, IOASRepo, CreateOASInput, UpdateOASInput } from '../interfaces/repos.interface'

@Injectable()
export class MemoryOASRepo implements IOASRepo {
  private store = new Map<string, OASEntry>()
  private nameIndex = new Map<string, string>()

  async create(data: CreateOASInput): Promise<OASEntry> {
    const now = new Date()
    const entry: OASEntry = { id: randomUUID(), groupId: data.groupId, name: data.name, description: data.description, remoteUrl: data.remoteUrl, baseEndpoint: data.baseEndpoint ?? null, authType: data.authType, authConfig: data.authConfig, cacheTtl: data.cacheTtl ?? 3600, enabled: true, createdAt: now, updatedAt: now }
    this.store.set(entry.id, entry)
    this.nameIndex.set(entry.name, entry.id)
    return entry
  }

  async findAll(): Promise<OASEntry[]> { return [...this.store.values()] }

  async findByGroup(groupId: string): Promise<OASEntry[]> {
    return [...this.store.values()].filter(e => e.groupId === groupId)
  }

  async findById(id: string): Promise<OASEntry | null> { return this.store.get(id) ?? null }

  async findByName(name: string): Promise<OASEntry | null> {
    const id = this.nameIndex.get(name)
    return id ? (this.store.get(id) ?? null) : null
  }

  async update(id: string, data: UpdateOASInput): Promise<OASEntry> {
    const entry = this.store.get(id)
    if (!entry) throw Object.assign(new Error(`OASEntry not found: ${id}`), { code: 'NOT_FOUND' })
    if (data.name && data.name !== entry.name) {
      this.nameIndex.delete(entry.name)
      this.nameIndex.set(data.name, id)
    }
    const updated: OASEntry = { ...entry, ...data, baseEndpoint: data.baseEndpoint !== undefined ? data.baseEndpoint : entry.baseEndpoint, updatedAt: new Date() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    const e = this.store.get(id)
    if (e) { this.nameIndex.delete(e.name); this.store.delete(id) }
  }
}
