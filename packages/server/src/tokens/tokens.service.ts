import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AppConfigService } from '../config/app-config.service'
import { JwtService } from '../crypto/jwt.service'
import { CACHE_ADAPTER } from '../cache/cache.token'
import { TOKEN_REPO } from '../storage/storage.tokens'
import type { ICacheAdapter } from '../cache/cache.interface'
import type { ITokenRepo, Token } from '../storage/interfaces/repos.interface'

const BLACKLIST_PREFIX = 'jti:blacklist:'

export interface IssueTokenResult { token: Token; jwt: string }

@Injectable()
export class TokensService {
  constructor(
    @Inject(TOKEN_REPO) private readonly tokenRepo: ITokenRepo,
    @Inject(CACHE_ADAPTER) private readonly cache: ICacheAdapter,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async issue(opts: { groupId: string; groupName: string; name: string; scopes?: string[]; ttlSec?: number }): Promise<IssueTokenResult> {
    const jti = randomUUID()
    const scopes = opts.scopes ?? ['oas:read']
    const ttl = opts.ttlSec ?? this.appConfig.jwtDefaultTtl
    const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000) : null

    const [token, jwt] = await Promise.all([
      this.tokenRepo.create({ groupId: opts.groupId, name: opts.name, jti, scopes, expiresAt }),
      this.jwtService.sign({ groupId: opts.groupId, groupName: opts.groupName, jti, scopes, expiresAt }),
    ])
    return { token, jwt }
  }

  async revoke(tokenId: string): Promise<void> {
    const token = await this.tokenRepo.findById(tokenId)
    if (!token) throw new NotFoundException(`Token not found: ${tokenId}`)
    if (token.revokedAt) return

    await this.tokenRepo.revoke(tokenId, new Date())
    const ttlSec = token.expiresAt
      ? Math.max(0, Math.floor((token.expiresAt.getTime() - Date.now()) / 1000))
      : 60 * 60 * 24 * 365
    await this.cache.set(`${BLACKLIST_PREFIX}${token.jti}`, true, ttlSec)
  }
}
