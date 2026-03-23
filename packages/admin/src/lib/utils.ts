import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lang } from './i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

export function relativeTime(date: string | Date | null | undefined, lang: Lang = 'en'): string {
  if (!date) return '—'
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  const seconds = Math.floor(diff / 1000)
  if (lang === 'zh') {
    if (seconds < 60) return '刚刚'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
