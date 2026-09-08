import type { CalEvent } from '@/types/event'

const KEY = 'voicecal.events.v1'

export function loadEvents(): CalEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveEvents(events: CalEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(events))
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
