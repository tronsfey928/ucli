import { Injectable, OnModuleDestroy } from '@nestjs/common'
import type { ICacheAdapter } from '../cache.interface'

interface Entry<T> {
  value: T
  expiresAt: number | null
}

@Injectable()
export class MemoryCacheAdapter implements ICacheAdapter, OnModuleDestroy {
  private store = new Map<string, Entry<unknown>>()
  private sweepTimer: ReturnType<typeof setInterval>

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), 60_000)
    if (this.sweepTimer.unref) this.sweepTimer.unref()
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as Entry<T> | undefined
    if (!entry) return null
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    this.store.set(key, { value, expiresAt: ttlSec != null ? Date.now() + ttlSec * 1000 : null })
  }

  async del(key: string): Promise<void> { this.store.delete(key) }

  async has(key: string): Promise<boolean> { return (await this.get(key)) !== null }

  async close(): Promise<void> { clearInterval(this.sweepTimer); this.store.clear() }

  onModuleDestroy() { void this.close() }

  private sweep(): void {
    const now = Date.now()
    for (const [k, e] of this.store.entries()) {
      if (e.expiresAt !== null && now > e.expiresAt) this.store.delete(k)
    }
  }
}
