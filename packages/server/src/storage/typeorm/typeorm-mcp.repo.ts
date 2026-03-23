import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { McpEntryEntity } from './entities/mcp-entry.entity'
import type { McpEntry, IMCPRepo, CreateMcpInput, UpdateMcpInput, McpAuthConfig } from '../interfaces/repos.interface'

function toEntry(e: McpEntryEntity): McpEntry {
  return {
    id: e.id, groupId: e.groupId, name: e.name, description: e.description,
    transport: e.transport as 'http' | 'stdio',
    serverUrl: e.serverUrl, command: e.command,
    authConfig: e.authConfig as unknown as McpAuthConfig, // encrypted string
    enabled: e.enabled, createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

@Injectable()
export class TypeORMMCPRepo implements IMCPRepo {
  constructor(@InjectRepository(McpEntryEntity) private readonly repo: Repository<McpEntryEntity>) {}

  async create(data: CreateMcpInput): Promise<McpEntry> {
    const entity = this.repo.create({
      groupId: data.groupId, name: data.name, description: data.description ?? '',
      transport: data.transport, serverUrl: data.serverUrl ?? null, command: data.command ?? null,
      authConfig: data.authConfig as unknown as string,
    })
    return toEntry(await this.repo.save(entity))
  }

  async findAll(): Promise<McpEntry[]> {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toEntry)
  }

  async findByGroup(groupId: string): Promise<McpEntry[]> {
    return (await this.repo.find({ where: { groupId }, order: { name: 'ASC' } })).map(toEntry)
  }

  async findById(id: string): Promise<McpEntry | null> {
    const e = await this.repo.findOneBy({ id })
    return e ? toEntry(e) : null
  }

  async findByName(name: string): Promise<McpEntry | null> {
    const e = await this.repo.findOneBy({ name })
    return e ? toEntry(e) : null
  }

  async update(id: string, data: UpdateMcpInput): Promise<McpEntry> {
    const updateData: Partial<McpEntryEntity> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.transport !== undefined) updateData.transport = data.transport
    if (data.serverUrl !== undefined) updateData.serverUrl = data.serverUrl
    if (data.command !== undefined) updateData.command = data.command
    if (data.authConfig !== undefined) updateData.authConfig = data.authConfig as unknown as string
    if (data.enabled !== undefined) updateData.enabled = data.enabled

    await this.repo.update(id, updateData)
    const updated = await this.repo.findOneBy({ id })
    if (!updated) throw Object.assign(new Error(`McpEntry not found: ${id}`), { code: 'NOT_FOUND' })
    return toEntry(updated)
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
