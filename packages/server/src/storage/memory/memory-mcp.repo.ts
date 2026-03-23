import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { McpEntry, IMCPRepo, CreateMcpInput, UpdateMcpInput } from '../interfaces/repos.interface'

@Injectable()
export class MemoryMCPRepo implements IMCPRepo {
  private store = new Map<string, McpEntry>()
  private nameIndex = new Map<string, string>()

  async create(data: CreateMcpInput): Promise<McpEntry> {
    const now = new Date()
    const entry: McpEntry = {
      id: randomUUID(), groupId: data.groupId, name: data.name,
      description: data.description, transport: data.transport,
      serverUrl: data.serverUrl ?? null, command: data.command ?? null,
      authConfig: data.authConfig, enabled: true, createdAt: now, updatedAt: now,
    }
    this.store.set(entry.id, entry)
    this.nameIndex.set(entry.name, entry.id)
    return entry
  }

  async findAll(): Promise<McpEntry[]> { return [...this.store.values()] }

  async findByGroup(groupId: string): Promise<McpEntry[]> {
    return [...this.store.values()].filter(e => e.groupId === groupId)
  }

  async findById(id: string): Promise<McpEntry | null> { return this.store.get(id) ?? null }

  async findByName(name: string): Promise<McpEntry | null> {
    const id = this.nameIndex.get(name)
    return id ? (this.store.get(id) ?? null) : null
  }

  async update(id: string, data: UpdateMcpInput): Promise<McpEntry> {
    const entry = this.store.get(id)
    if (!entry) throw Object.assign(new Error(`McpEntry not found: ${id}`), { code: 'NOT_FOUND' })
    if (data.name && data.name !== entry.name) {
      this.nameIndex.delete(entry.name)
      this.nameIndex.set(data.name, id)
    }
    const updated: McpEntry = {
      ...entry, ...data,
      serverUrl: data.serverUrl !== undefined ? data.serverUrl : entry.serverUrl,
      command: data.command !== undefined ? data.command : entry.command,
      updatedAt: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    const e = this.store.get(id)
    if (e) { this.nameIndex.delete(e.name); this.store.delete(id) }
  }
}
