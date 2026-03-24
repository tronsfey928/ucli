import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { OAS_REPO } from '../storage/storage.tokens'
import { EncryptionService } from '../crypto/encryption.service'
import type { IOASRepo, OASEntry, CreateOASInput, UpdateOASInput, AuthConfig } from '../storage/interfaces/repos.interface'

@Injectable()
export class OASService {
  constructor(
    @Inject(OAS_REPO) private readonly oasRepo: IOASRepo,
    private readonly encryption: EncryptionService,
  ) {}

  async create(data: CreateOASInput): Promise<OASEntry> {
    const existing = await this.oasRepo.findByName(data.name)
    if (existing) throw new ConflictException(`OAS name already exists: ${data.name}`)
    const entry = await this.oasRepo.create({
      ...data,
      authConfig: this.encryption.encrypt(data.authConfig) as unknown as AuthConfig,
    })
    return this.decrypt(entry)
  }

  async findByGroup(groupId: string): Promise<OASEntry[]> {
    const entries = await this.oasRepo.findByGroup(groupId)
    return entries.filter(e => e.enabled).map(e => this.decrypt(e))
  }

  async findAll(): Promise<OASEntry[]> {
    return (await this.oasRepo.findAll()).map(e => this.decrypt(e))
  }

  async findByName(name: string, groupId?: string): Promise<OASEntry> {
    const entry = await this.oasRepo.findByName(name)
    if (!entry) throw new NotFoundException(`OAS not found: ${name}`)
    if (groupId && entry.groupId !== groupId) throw new NotFoundException(`OAS not found: ${name}`)
    if (groupId && !entry.enabled) throw new NotFoundException(`OAS not found: ${name}`)
    return this.decrypt(entry)
  }

  async findById(id: string): Promise<OASEntry> {
    const entry = await this.oasRepo.findById(id)
    if (!entry) throw new NotFoundException(`OAS not found: ${id}`)
    return this.decrypt(entry)
  }

  async update(id: string, data: UpdateOASInput): Promise<OASEntry> {
    // Strip undefined values so partial updates don't overwrite stored fields
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    ) as UpdateOASInput
    if (updateData.authConfig) {
      updateData.authConfig = this.encryption.encrypt(updateData.authConfig) as unknown as AuthConfig
    }
    const updated = await this.oasRepo.update(id, updateData)
    return this.decrypt(updated)
  }

  async delete(id: string): Promise<void> {
    await this.oasRepo.delete(id)
  }

  private decrypt(entry: OASEntry): OASEntry {
    return { ...entry, authConfig: this.encryption.decrypt(entry.authConfig as unknown as string) as AuthConfig }
  }
}
