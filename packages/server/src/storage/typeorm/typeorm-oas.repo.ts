import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OASEntryEntity } from './entities/oas-entry.entity'
import type { OASEntry, IOASRepo, CreateOASInput, UpdateOASInput, AuthConfig, AuthType } from '../interfaces/repos.interface'

function toEntry(e: OASEntryEntity): OASEntry {
  return {
    id: e.id, groupId: e.groupId, name: e.name, description: e.description,
    remoteUrl: e.remoteUrl, baseEndpoint: e.baseEndpoint,
    authType: e.authType as AuthType,
    authConfig: e.authConfig as unknown as AuthConfig, // encrypted string
    cacheTtl: e.cacheTtl, enabled: e.enabled,
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

@Injectable()
export class TypeORMOASRepo implements IOASRepo {
  constructor(@InjectRepository(OASEntryEntity) private readonly repo: Repository<OASEntryEntity>) {}

  async create(data: CreateOASInput): Promise<OASEntry> {
    const entity = this.repo.create({
      groupId: data.groupId, name: data.name, description: data.description ?? '',
      remoteUrl: data.remoteUrl, baseEndpoint: data.baseEndpoint ?? null,
      authType: data.authType, authConfig: data.authConfig as unknown as string,
      cacheTtl: data.cacheTtl ?? 3600,
    })
    return toEntry(await this.repo.save(entity))
  }

  async findAll(): Promise<OASEntry[]> {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toEntry)
  }

  async findByGroup(groupId: string): Promise<OASEntry[]> {
    return (await this.repo.find({ where: { groupId }, order: { name: 'ASC' } })).map(toEntry)
  }

  async findById(id: string): Promise<OASEntry | null> {
    const e = await this.repo.findOneBy({ id })
    return e ? toEntry(e) : null
  }

  async findByName(name: string, groupId?: string): Promise<OASEntry | null> {
    const where: Record<string, string> = { name }
    if (groupId) where.groupId = groupId
    const e = await this.repo.findOneBy(where)
    return e ? toEntry(e) : null
  }

  async update(id: string, data: UpdateOASInput): Promise<OASEntry> {
    const updateData: Partial<OASEntryEntity> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.remoteUrl !== undefined) updateData.remoteUrl = data.remoteUrl
    if (data.baseEndpoint !== undefined) updateData.baseEndpoint = data.baseEndpoint
    if (data.authType !== undefined) updateData.authType = data.authType
    if (data.authConfig !== undefined) updateData.authConfig = data.authConfig as unknown as string
    if (data.cacheTtl !== undefined) updateData.cacheTtl = data.cacheTtl
    if (data.enabled !== undefined) updateData.enabled = data.enabled

    await this.repo.update(id, updateData)
    const updated = await this.repo.findOneBy({ id })
    if (!updated) throw Object.assign(new Error(`OASEntry not found: ${id}`), { code: 'NOT_FOUND' })
    return toEntry(updated)
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
