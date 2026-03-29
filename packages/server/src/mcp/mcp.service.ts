import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
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
    this.validateTransport(data.transport, data.serverUrl, data.command)
    const existing = await this.mcpRepo.findByName(data.name, data.groupId)
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
    const entry = await this.mcpRepo.findByName(name, groupId)
    if (!entry) throw new NotFoundException(`MCP server not found: ${name}`)
    if (groupId && entry.groupId !== groupId) throw new NotFoundException(`MCP server not found: ${name}`)
    if (groupId && !entry.enabled) throw new NotFoundException(`MCP server not found: ${name}`)
    return this.decrypt(entry)
  }

  async update(id: string, data: UpdateMcpInput): Promise<McpEntry> {
    const current = await this.mcpRepo.findById(id)
    if (!current) throw new NotFoundException(`MCP server not found: ${id}`)

    // Validate transport configuration against merged state
    const transport = data.transport ?? current.transport
    const serverUrl = data.serverUrl !== undefined ? data.serverUrl : current.serverUrl
    const command = data.command !== undefined ? data.command : current.command
    this.validateTransport(transport, serverUrl, command)

    // Validate name uniqueness within the same group on rename
    if (data.name && data.name !== current.name) {
      const conflict = await this.mcpRepo.findByName(data.name, current.groupId)
      if (conflict) throw new ConflictException(`MCP server name already exists: ${data.name}`)
    }

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

  async probe(serverUrl: string, headers?: Record<string, string>): Promise<{ status: 'ok' | 'error'; message: string; latencyMs: number }> {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(serverUrl, {
        method: 'GET',
        headers: { ...(headers ?? {}) },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const latencyMs = Date.now() - start
      if (res.ok || res.status === 405) {
        return { status: 'ok', message: `Server responded with HTTP ${res.status}`, latencyMs }
      }
      return { status: 'error', message: `Server responded with HTTP ${res.status} ${res.statusText}`, latencyMs }
    } catch (err: unknown) {
      const latencyMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'error', message: `Connection failed: ${msg}`, latencyMs }
    }
  }

  private decrypt(entry: McpEntry): McpEntry {
    return { ...entry, authConfig: this.encryption.decrypt(entry.authConfig as unknown as string) as McpAuthConfig }
  }

  private validateTransport(transport: string, serverUrl?: string | null, command?: string | null): void {
    if (transport === 'http' && !serverUrl) {
      throw new BadRequestException('serverUrl is required for http transport')
    }
    if (transport === 'stdio' && !command) {
      throw new BadRequestException('command is required for stdio transport')
    }
  }
}
