import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CalEvent, ParsedDraft } from '@/types/event'
import { loadEvents, saveEvents, uid } from '@/lib/storage'
import { toISODate } from '@/lib/parser'
import { occursOn } from '@/lib/recur'

export function useEvents() {
  const [events, setEvents] = useState<CalEvent[]>(() => loadEvents())

  useEffect(() => {
    saveEvents(events)
  }, [events])

  // 多窗口同步（主窗口与桌面小组件共享 localStorage）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'voicecal.events.v1' && e.newValue) {
        try {
          setEvents(JSON.parse(e.newValue))
        } catch { /* noop */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addFromDraft = useCallback((d: ParsedDraft, source: 'voice' | 'manual') => {
    setEvents((prev) => [
      ...prev,
      {
        id: uid(),
        title: d.title,
        startDate: d.startDate,
        endDate: d.endDate,
        startTime: d.startTime,
        endTime: d.endTime,
        color: d.color,
        recur: d.recur,
        done: false,
        source,
        rawText: d.rawText,
        createdAt: Date.now(),
      },
    ])
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<CalEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const toggleDone = useCallback((id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, done: !e.done } : e)))
  }, [])

  /** 首次使用可一键载入示例日程，直观感受配色与跨天条 */
  const seedDemo = useCallback(() => {
    const t = new Date()
    const iso = (offset: number) => {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset)
      return toISODate(d)
    }
    const demo: Array<Omit<CalEvent, 'id' | 'createdAt' | 'done' | 'source'>> = [
      { title: '项目评审会', startDate: iso(1), endDate: iso(1), startTime: '15:00', endTime: '17:00', color: 'work' },
      { title: '写本周周报', startDate: iso(1), endDate: iso(1), startTime: '10:00', endTime: '11:00', color: 'work' },
      { title: '视频面试', startDate: iso(1), endDate: iso(1), startTime: '14:00', endTime: '14:45', color: 'default' },
      { title: '晚间瑜伽课', startDate: iso(1), endDate: iso(1), startTime: '20:30', endTime: '21:30', color: 'health' },
      { title: '杭州出差', startDate: iso(3), endDate: iso(5), startTime: '', endTime: '', color: 'travel' },
      { title: '晨跑 5 公里', startDate: iso(0), endDate: iso(0), startTime: '07:00', endTime: '07:45', color: 'health', recur: { freq: 'daily' } },
      { title: '陪家人吃饭', startDate: iso(0), endDate: iso(0), startTime: '19:00', endTime: '', color: 'social' },
      { title: '读完《时间管理》两章', startDate: iso(2), endDate: iso(2), startTime: '', endTime: '', color: 'study' },
    ]
    setEvents((prev) => {
      if (prev.length > 0) return prev // StrictMode 双调用防护
      return [
        ...prev,
        ...demo.map((d) => ({ ...d, id: uid(), createdAt: Date.now(), done: false, source: 'manual' as const })),
      ]
    })
  }, [])

  // ?demo 参数且当前为空 → 自动载入示例
  useEffect(() => {
    if (
      events.length === 0 &&
      (location.search.includes('demo') || location.hash.includes('demo'))
    ) {
      seedDemo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { events, addFromDraft, updateEvent, removeEvent, toggleDone, seedDemo }
}

/** 某日的所有事件（含跨天覆盖与重复事件命中） */
export function eventsOnDay(events: CalEvent[], iso: string): CalEvent[] {
  return events
    .filter((e) => occursOn(e, iso))
    .sort((a, b) => {
      const aAll = a.startTime ? 1 : 0
      const bAll = b.startTime ? 1 : 0
      if (aAll !== bAll) return aAll - bAll
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function useTodayEvents(events: CalEvent[]): CalEvent[] {
  const iso = todayISO()
  return useMemo(() => eventsOnDay(events, iso), [events, iso])
}
