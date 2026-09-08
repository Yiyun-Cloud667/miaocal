import type { CalEvent, Recur } from '@/types/event'

/** 判断重复事件在某日是否发生 */
export function occursOn(e: CalEvent, iso: string): boolean {
  if (!e.recur) return e.startDate <= iso && iso <= e.endDate
  if (iso < e.startDate) return false
  const r: Recur = e.recur
  const d = new Date(iso + 'T00:00:00')
  if (r.freq === 'daily') return true
  if (r.freq === 'weekly') return ((d.getDay() + 6) % 7) + 1 === (r.byDay ?? 1)
  if (r.freq === 'monthly') return d.getDate() === (r.byDay ?? 1)
  return false
}

/** 区间内所有发生日（普通事件返回覆盖的每一天；重复事件返回命中日） */
export function occurrencesInRange(e: CalEvent, startISO: string, endISO: string): string[] {
  const out: string[] = []
  const s = new Date(startISO + 'T00:00:00')
  const t = new Date(endISO + 'T00:00:00')
  for (let d = new Date(s); d <= t; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (occursOn(e, iso)) out.push(iso)
  }
  return out
}

export function recurLabel(r?: Recur): string {
  if (!r) return ''
  if (r.freq === 'daily') return '每天'
  if (r.freq === 'weekly') return `每周${'一二三四五六日'[(r.byDay ?? 1) - 1]}`
  if (r.freq === 'monthly') return `每月${r.byDay}号`
  return ''
}
