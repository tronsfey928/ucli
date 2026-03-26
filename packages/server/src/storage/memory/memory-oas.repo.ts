import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { OASEntry, IOASRepo, CreateOASInput, UpdateOASInput } from '../interfaces/repos.interface'

@Injectable()
export class MemoryOASRepo implements IOASRepo {
  private store = new Map<string, OASEntry>()
  /** Key: `${groupId}:${name}` → entry id */
  private nameIndex = new Map<string, string>()

  private nameKey(groupId: string, name: string): string {
    return `${groupId}:${name}`
  }

  async create(data: CreateOASInput): Promise<OASEntry> {
    const now = new Date()
    const entry: OASEntry = { id: randomUUID(), groupId: data.groupId, name: data.name, description: data.description, remoteUrl: data.remoteUrl, baseEndpoint: data.baseEndpoint ?? null, authType: data.authType, authConfig: data.authConfig, cacheTtl: data.cacheTtl ?? 3600, enabled: true, createdAt: now, updatedAt: now }
    this.store.set(entry.id, entry)
    this.nameIndex.set(this.nameKey(entry.groupId, entry.name), entry.id)
    return entry
  }

  async findAll(): Promise<OASEntry[]> { return [...this.store.values()] }

  async findByGroup(groupId: string): Promise<OASEntry[]> {
    return [...this.store.values()].filter(e => e.groupId === groupId)
  }

  async findById(id: string): Promise<OASEntry | null> { return this.store.get(id) ?? null }

  async findByName(name: string, groupId?: string): Promise<OASEntry | null> {
    if (groupId) {
      const id = this.nameIndex.get(this.nameKey(groupId, name))
      return id ? (this.store.get(id) ?? null) : null
    }
    // Fallback: scan all entries (used rarely, e.g. admin lookups without group context)
    for (const entry of this.store.values()) {
      if (entry.name === name) return entry
    }
    return null
  }

  async update(id: string, data: UpdateOASInput): Promise<OASEntry> {
    const entry = this.store.get(id)
    if (!entry) throw Object.assign(new Error(`OASEntry not found: ${id}`), { code: 'NOT_FOUND' })
    if (data.name && data.name !== entry.name) {
      this.nameIndex.delete(this.nameKey(entry.groupId, entry.name))
      this.nameIndex.set(this.nameKey(entry.groupId, data.name), id)
    }
    const updated: OASEntry = { ...entry, ...data, baseEndpoint: data.baseEndpoint !== undefined ? data.baseEndpoint : entry.baseEndpoint, updatedAt: new Date() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    const e = this.store.get(id)
    if (e) { this.nameIndex.delete(this.nameKey(e.groupId, e.name)); this.store.delete(id) }
  }
}
