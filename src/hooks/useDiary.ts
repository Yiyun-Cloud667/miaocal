import { useCallback, useEffect, useState } from 'react'
import type { DiaryEntry } from '@/types/diary'

const KEY = 'voicecal.diary.v1'

type DiaryMap = Record<string, DiaryEntry>

function load(): DiaryMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useDiary() {
  const [entries, setEntries] = useState<DiaryMap>(() => load())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(entries))
  }, [entries])

  // 多窗口同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setEntries(JSON.parse(e.newValue))
        } catch { /* noop */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const saveEntry = useCallback((date: string, patch: Partial<Omit<DiaryEntry, 'date' | 'updatedAt'>>) => {
    setEntries((prev) => {
      const cur = prev[date] ?? { date, mood: '', text: '', updatedAt: 0 }
      const next = { ...cur, ...patch, updatedAt: Date.now() }
      // 空内容则删除条目
      if (!next.mood && !next.text.trim()) {
        const { [date]: _drop, ...rest } = prev
        return rest
      }
      return { ...prev, [date]: next }
    })
  }, [])

  // ?demo 参数且当前为空 → 自动载入一篇示例手记
  useEffect(() => {
    if (
      Object.keys(entries).length === 0 &&
      (location.search.includes('demo') || location.hash.includes('demo'))
    ) {
      const t = new Date()
      const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
      setEntries((prev) =>
        Object.keys(prev).length > 0
          ? prev
          : {
              [iso]: {
                date: iso,
                mood: 'good',
                text: '开始用猫历记录每一天。上午效率很高，下午开完评审会突然轻松了。明天继续。',
                updatedAt: Date.now(),
              },
            },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { entries, saveEntry }
}
