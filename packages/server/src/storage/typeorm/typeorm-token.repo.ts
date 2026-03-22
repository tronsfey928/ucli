import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TokenEntity } from './entities/token.entity'
import type { Token, ITokenRepo, CreateTokenInput } from '../interfaces/repos.interface'

function toToken(e: TokenEntity): Token {
  return { id: e.id, groupId: e.groupId, name: e.name, jti: e.jti, scopes: e.scopes, expiresAt: e.expiresAt, revokedAt: e.revokedAt, createdAt: e.createdAt }
}

@Injectable()
export class TypeORMTokenRepo implements ITokenRepo {
  constructor(@InjectRepository(TokenEntity) private readonly repo: Repository<TokenEntity>) {}

  async create(data: CreateTokenInput): Promise<Token> {
    const entity = this.repo.create({
      groupId: data.groupId, name: data.name, jti: data.jti,
      scopes: data.scopes, expiresAt: data.expiresAt,
    })
    return toToken(await this.repo.save(entity))
  }

  async findById(id: string): Promise<Token | null> {
    const e = await this.repo.findOneBy({ id })
    return e ? toToken(e) : null
  }

  async findByJti(jti: string): Promise<Token | null> {
    const e = await this.repo.findOneBy({ jti })
    return e ? toToken(e) : null
  }

  async findByGroup(groupId: string): Promise<Token[]> {
    return (await this.repo.find({ where: { groupId }, order: { createdAt: 'DESC' } })).map(toToken)
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.repo.update(id, { revokedAt })
  }
}
