import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Token, ITokenRepo, CreateTokenInput } from '../interfaces/repos.interface'

@Injectable()
export class MemoryTokenRepo implements ITokenRepo {
  private store = new Map<string, Token>()
  private jtiIndex = new Map<string, string>()

  async create(data: CreateTokenInput): Promise<Token> {
    const token: Token = { id: randomUUID(), groupId: data.groupId, name: data.name, jti: data.jti, scopes: data.scopes, expiresAt: data.expiresAt, revokedAt: null, createdAt: new Date() }
    this.store.set(token.id, token)
    this.jtiIndex.set(token.jti, token.id)
    return token
  }

  async findById(id: string): Promise<Token | null> { return this.store.get(id) ?? null }

  async findByJti(jti: string): Promise<Token | null> {
    const id = this.jtiIndex.get(jti)
    return id ? (this.store.get(id) ?? null) : null
  }

  async findByGroup(groupId: string): Promise<Token[]> {
    return [...this.store.values()].filter(t => t.groupId === groupId)
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    const t = this.store.get(id)
    if (t) this.store.set(id, { ...t, revokedAt })
  }
}
