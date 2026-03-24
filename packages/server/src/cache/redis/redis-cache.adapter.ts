import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import type { ICacheAdapter } from '../cache.interface'

@Injectable()
export class RedisCacheAdapter implements ICacheAdapter, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name)
  private readonly client: Redis

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
    })
    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`)
    })
  }

  async connect(): Promise<void> { await this.client.connect() }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      this.logger.warn(`Corrupted cache entry for key "${key}", deleting`)
      await this.client.del(key)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    const s = JSON.stringify(value)
    if (ttlSec != null && ttlSec > 0) await this.client.set(key, s, 'EX', ttlSec)
    else await this.client.set(key, s)
  }

  async del(key: string): Promise<void> { await this.client.del(key) }

  async has(key: string): Promise<boolean> { return (await this.client.exists(key)) === 1 }

  async close(): Promise<void> { await this.client.quit() }

  onModuleDestroy() { void this.close() }

  async ping(): Promise<boolean> {
    try { return (await this.client.ping()) === 'PONG' } catch { return false }
  }
}
