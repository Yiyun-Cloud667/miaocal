import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalEvent } from '@/types/event'
import { occursOn } from '@/lib/recur'

const ENABLED_KEY = 'voicecal.notify.enabled'
const FIRED_KEY = 'voicecal.notify.fired.v1'
const LEAD_MINUTES = 10

function firedMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}')
  } catch {
    return {}
  }
}

/** 计算当前需要提醒的事件（纯函数，便于测试） */
export function dueReminders(events: CalEvent[], now: Date): Array<{ event: CalEvent; startAt: Date }> {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const out: Array<{ event: CalEvent; startAt: Date }> = []
  for (const e of events) {
    if (e.done || !e.startTime || !occursOn(e, iso)) continue
    const [h, m] = e.startTime.split(':').map(Number)
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
    const diffMin = (startAt.getTime() - now.getTime()) / 60000
    if (diffMin > 0 && diffMin <= LEAD_MINUTES) out.push({ event: e, startAt })
  }
  return out
}

/** 本地提醒：开启后，定时事件开始前 10 分钟推送系统通知 */
export function useReminders(events: CalEvent[]) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLED_KEY) === '1')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const enable = useCallback(async () => {
    if (!('Notification' in window)) return false
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (perm === 'granted') {
      localStorage.setItem(ENABLED_KEY, '1')
      setEnabled(true)
      return true
    }
    return false
  }, [])

  const disable = useCallback(() => {
    localStorage.removeItem(ENABLED_KEY)
    setEnabled(false)
  }, [])

  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const check = () => {
      const now = new Date()
      const fired = firedMap()
      for (const { event, startAt } of dueReminders(events, now)) {
        const key = `${event.id}@${startAt.getTime()}`
        if (fired[key]) continue
        fired[key] = Date.now()
        new Notification('猫历提醒', {
          body: `${event.startTime} ${event.title}${event.endTime ? `（至 ${event.endTime}）` : ''}`,
          tag: key,
        })
      }
      localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
    }
    check()
    timer.current = setInterval(check, 30_000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [enabled, events])

  return { enabled, enable, disable }
}
