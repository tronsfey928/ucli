import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { MCP_REPO } from '../storage/storage.tokens'
import { EncryptionService } from '../crypto/encryption.service'
import type { IMCPRepo, McpEntry, CreateMcpInput, UpdateMcpInput, McpAuthConfig } from '../storage/interfaces/repos.interface'

@Injectable()
export class MCPService {
  constructor(
    @Inject(MCP_REPO) private readonly mcpRepo: IMCPRepo,
    private readonly encryption: EncryptionService,
  ) {}

  async create(data: CreateMcpInput): Promise<McpEntry> {
    const existing = await this.mcpRepo.findByName(data.name)
    if (existing) throw new ConflictException(`MCP server name already exists: ${data.name}`)
    const entry = await this.mcpRepo.create({
      ...data,
      authConfig: this.encryption.encrypt(data.authConfig) as unknown as McpAuthConfig,
    })
    return this.decrypt(entry)
  }

  async findAll(): Promise<McpEntry[]> {
    return (await this.mcpRepo.findAll()).map(e => this.decrypt(e))
  }

  async findById(id: string): Promise<McpEntry> {
    const entry = await this.mcpRepo.findById(id)
    if (!entry) throw new NotFoundException(`MCP server not found: ${id}`)
    return this.decrypt(entry)
  }

  async findByGroup(groupId: string): Promise<McpEntry[]> {
    const entries = await this.mcpRepo.findByGroup(groupId)
    return entries.filter(e => e.enabled).map(e => this.decrypt(e))
  }

  async findByName(name: string, groupId?: string): Promise<McpEntry> {
    const entry = await this.mcpRepo.findByName(name)
    if (!entry) throw new NotFoundException(`MCP server not found: ${name}`)
    if (groupId && entry.groupId !== groupId) throw new NotFoundException(`MCP server not found: ${name}`)
    if (groupId && !entry.enabled) throw new NotFoundException(`MCP server not found: ${name}`)
    return this.decrypt(entry)
  }

  async update(id: string, data: UpdateMcpInput): Promise<McpEntry> {
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    ) as UpdateMcpInput
    if (updateData.authConfig) {
      updateData.authConfig = this.encryption.encrypt(updateData.authConfig) as unknown as McpAuthConfig
    }
    const updated = await this.mcpRepo.update(id, updateData)
    return this.decrypt(updated)
  }

  async delete(id: string): Promise<void> {
    await this.mcpRepo.delete(id)
  }

  private decrypt(entry: McpEntry): McpEntry {
    return { ...entry, authConfig: this.encryption.decrypt(entry.authConfig as unknown as string) as McpAuthConfig }
  }
}
