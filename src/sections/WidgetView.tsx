/**
 * 桌面小组件模式：Electron 无边框常驻窗体加载 #/widget 时渲染本组件
 * 上半：迷你月历（有日程打点）；下半：今日待办
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEvents, eventsOnDay } from '@/hooks/useEvents'
import { useDiary } from '@/hooks/useDiary'
import { MOODS, moodOf } from '@/types/diary'
import { toISODate, COLOR_PALETTE } from '@/lib/parser'

const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties
const NODRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties

export default function WidgetView() {
  const { events, toggleDone } = useEvents()
  const { entries: diary, saveEntry: saveDiary } = useDiary()
  const [now, setNow] = useState(() => new Date())
  const [mode, setMode] = useState<'calendar' | 'agenda' | 'diary'>(() => {
    const m = (location.search + location.hash).match(/mode=(calendar|agenda|diary)/)
    return (m?.[1] as 'calendar' | 'agenda' | 'diary') ?? 'calendar'
  })

  // 透明窗体：widget 模式下页面背景透明，整体可拖动
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
  }, [])

  // 每分钟刷新，跨午夜自动切到新的一天
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const today = toISODate(now)

  // 月份翻页 + 选中日期（待办/手记模式跟随选中日期）
  const [viewY, setViewY] = useState(now.getFullYear())
  const [viewM, setViewM] = useState(now.getMonth())
  const [selectedISO, setSelectedISO] = useState(today)

  const shiftMonth = (delta: number) => {
    const d = new Date(viewY, viewM + delta, 1)
    setViewY(d.getFullYear())
    setViewM(d.getMonth())
  }

  const y = viewY
  const m = viewM

  const cells = useMemo(() => {
    const first = new Date(y, m, 1)
    const offset = (first.getDay() + 6) % 7
    const n = new Date(y, m + 1, 0).getDate()
    const arr: Array<{ day: number; iso: string } | null> = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let d = 1; d <= n; d++) arr.push({ day: d, iso: toISODate(new Date(y, m, d)) })
    return arr
  }, [y, m])

  const selDate = new Date(selectedISO + 'T00:00:00')
  const dayEvents = eventsOnDay(events, selectedISO)

  return (
    <div className="min-h-screen bg-transparent p-2">
      <div
        className="w-[300px] rounded-2xl bg-[#131b36]/95 p-4 text-stone-200 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
        style={DRAG}
      >
        <div className="mb-3 flex items-baseline justify-between">
          {mode === 'calendar' ? (
            <span className="flex items-center gap-1" style={NODRAG}>
              <button onClick={() => shiftMonth(-1)} className="rounded px-1 text-stone-500 hover:bg-white/10 hover:text-stone-200" aria-label="上一月">
                ‹
              </button>
              <span className="font-serif-cn text-sm text-stone-100">{y}年{m + 1}月</span>
              <button onClick={() => shiftMonth(1)} className="rounded px-1 text-stone-500 hover:bg-white/10 hover:text-stone-200" aria-label="下一月">
                ›
              </button>
            </span>
          ) : (
            <span className="font-serif-cn text-sm text-stone-100">
              {selDate.getMonth() + 1}月{selDate.getDate()}日
              {selectedISO === today && <span className="ml-1 text-[10px] text-stone-500">今天</span>}
            </span>
          )}
          <div
            className="flex gap-1 rounded-full bg-white/5 p-0.5 text-[10px]"
            style={NODRAG}
          >
            {(['calendar', 'agenda', 'diary'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  mode === k ? 'bg-white/15 text-stone-100' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {k === 'calendar' ? '日历' : k === 'agenda' ? '待办' : '手记'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'calendar' ? (
          <div className="grid grid-cols-7 gap-y-1.5 text-center" style={NODRAG}>
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <span key={w} className="text-[9px] text-stone-500">{w}</span>
            ))}
            {cells.map((c, i) => {
              if (!c) return <span key={i} />
              const evs = eventsOnDay(events, c.iso).filter((e) => !e.done)
              const isSel = c.iso === selectedISO
              return (
                <div key={i} className="flex flex-col items-center">
                  <button
                    onClick={() => setSelectedISO(c.iso)}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors ${
                      c.iso === today
                        ? 'bg-stone-100 font-medium text-stone-900'
                        : isSel
                          ? 'bg-white/20 text-stone-100 ring-1 ring-white/40'
                          : 'text-stone-400 hover:bg-white/10 hover:text-stone-200'
                    }`}
                  >
                    {c.day}
                  </button>
                  <span
                    className="mt-0.5 h-1 w-1 rounded-full"
                    style={{
                      backgroundColor:
                        evs.length > 0
                          ? (COLOR_PALETTE[evs[0].color] ?? COLOR_PALETTE.default).dot
                          : 'transparent',
                    }}
                  />
                </div>
              )
            })}
          </div>
        ) : mode === 'agenda' ? (
          <div
            className="max-h-[240px] space-y-2 overflow-y-auto"
            style={NODRAG}
          >
            {dayEvents.length === 0 && (
              <div className="py-8 text-center text-[11px] text-stone-500">这一天暂无安排</div>
            )}
            {dayEvents.map((e) => {
              const c = COLOR_PALETTE[e.color] ?? COLOR_PALETTE.default
              return (
                <div key={e.id} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDone(e.id)}
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      e.done ? 'border-transparent' : 'border-stone-500'
                    }`}
                    style={e.done ? { backgroundColor: c.bar } : {}}
                  >
                    {e.done && (
                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6.5L5 9.5L10 3" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                  <span className={`truncate text-xs ${e.done ? 'text-stone-600 line-through' : 'text-stone-300'}`}>
                    {e.title}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-stone-500">
                    {e.startTime || '全天'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <WidgetDiary
            iso={selectedISO}
            mood={diary[selectedISO]?.mood ?? ''}
            text={diary[selectedISO]?.text ?? ''}
            onSave={saveDiary}
          />
        )}

        <div className="mt-3 border-t border-white/5 pt-2 text-center text-[9px] tracking-widest text-stone-600">
          猫历 MIAOCAL
        </div>
      </div>
    </div>
  )
}

/** 小组件 · 手记模式：心情速记 + 三行随笔，自动保存 */
function WidgetDiary(props: {
  iso: string
  mood: string
  text: string
  onSave: (date: string, patch: { mood?: string; text?: string }) => void
}) {
  const { iso, mood, text, onSave } = props
  const [draft, setDraft] = useState(text)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDraft(text)
  }, [iso, text])

  const change = (v: string) => {
    setDraft(v)
    setSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSave(iso, { text: v })
      setSaved(true)
    }, 600)
  }

  const moodInfo = moodOf(mood)

  return (
    <div style={NODRAG}>
      {/* 心情速记 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {MOODS.map((m) => (
            <button
              key={m.key}
              title={m.label}
              onClick={() => onSave(iso, { mood: mood === m.key ? '' : m.key })}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
                mood === m.key ? 'scale-110 bg-white/15' : 'opacity-45 hover:opacity-100'
              }`}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        {moodInfo && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] text-white"
            style={{ backgroundColor: moodInfo.color }}
          >
            {moodInfo.label}
          </span>
        )}
      </div>

      {/* 随笔 */}
      <textarea
        value={draft}
        onChange={(e) => change(e.target.value)}
        placeholder="写两句今天…"
        rows={4}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs leading-5 text-stone-300 outline-none placeholder:text-stone-600 focus:border-white/20"
      />
      <div className="mt-1 flex items-center justify-between text-[9px] text-stone-600">
        <span>{draft.length} 字</span>
        <span className={saved ? 'text-emerald-500/80' : ''}>{saved ? '已保存' : ''}</span>
      </div>
    </div>
  )
}
