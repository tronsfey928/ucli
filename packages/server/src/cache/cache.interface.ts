export interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>
  del(key: string): Promise<void>
  has(key: string): Promise<boolean>
  close(): Promise<void>
}
