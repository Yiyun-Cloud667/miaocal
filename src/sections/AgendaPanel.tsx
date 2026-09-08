import { useState } from 'react'
import type { CalEvent } from '@/types/event'
import type { DiaryEntry } from '@/types/diary'
import { eventsOnDay } from '@/hooks/useEvents'
import { COLOR_PALETTE } from '@/lib/parser'
import { recurLabel } from '@/lib/recur'
import { holidayOf } from '@/lib/holidays'
import DiaryPanel from '@/sections/DiaryPanel'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function AgendaPanel(props: {
  iso: string
  events: CalEvent[]
  onToggleDone: (id: string) => void
  onOpenEvent: (e: CalEvent) => void
  onSeedDemo?: () => void
  diaryEntry?: DiaryEntry
  onSaveDiary: (date: string, patch: { mood?: string; text?: string }) => void
}) {
  const { iso, events } = props
  const [tab, setTab] = useState<'todo' | 'diary'>(() =>
    (location.search + location.hash).includes('tab=diary') ? 'diary' : 'todo',
  )
  const list = eventsOnDay(events, iso)
  const d = new Date(iso + 'T00:00:00')
  const isToday = iso === (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` })()
  const holiday = holidayOf(iso)
  const pending = list.filter((e) => !e.done).length

  return (
    <div className="flex h-full flex-col">
      {/* 待办 / 手记 切换 */}
      <div className="mb-3 flex gap-1 rounded-full bg-stone-100 p-0.5 text-[11px]">
        {(['todo', 'diary'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full py-1 transition-colors ${
              tab === k ? 'bg-white text-stone-700 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {k === 'todo' ? '待办' : '手记'}
          </button>
        ))}
      </div>

      {tab === 'diary' ? (
        <DiaryPanel iso={iso} entry={props.diaryEntry} onSave={props.onSaveDiary} />
      ) : (
        <>
      <div className="mb-4">
        <div className="text-xs tracking-widest text-stone-400">
          {isToday ? '今日待办' : '当日安排'}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-serif-cn text-3xl text-[#0F1326]">
            {d.getMonth() + 1}月{d.getDate()}日
          </span>
          <span className="text-sm text-stone-400">{WEEK[d.getDay()]}</span>
          {holiday && <span className="text-xs text-rose-500">{holiday}</span>}
        </div>
        <div className="mt-1 text-xs text-stone-400">
          {list.length === 0 ? '这一天还没有安排' : `${pending} 项待完成 · ${list.length - pending} 项已完成`}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {list.map((e) => {
          const c = COLOR_PALETTE[e.color] ?? COLOR_PALETTE.default
          const multi = e.startDate !== e.endDate
          return (
            <div
              key={e.id}
              className={`group flex items-start gap-3 rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2.5 transition-shadow hover:shadow-sm ${
                e.done ? 'opacity-55' : ''
              }`}
            >
              <button
                onClick={() => props.onToggleDone(e.id)}
                aria-label="完成打卡"
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                  e.done ? 'border-transparent text-white' : 'border-stone-300 hover:border-stone-500'
                }`}
                style={e.done ? { backgroundColor: c.bar } : {}}
              >
                {e.done && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6.5L5 9.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => props.onOpenEvent(e)}>
                <div className="flex items-center gap-1.5">
                  <div className={`min-w-0 truncate text-sm text-stone-700 ${e.done ? 'line-through' : ''}`}>
                    {e.title}
                  </div>
                  {e.recur && (
                    <span title={`${recurLabel(e.recur)}重复`} className="shrink-0 text-[10px] text-stone-400">
                      🔁
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-stone-400">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
                  <span className="shrink-0">
                    {e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : '全天'}
                  </span>
                  {multi && (
                    <span className="shrink-0">
                      · {Number(e.startDate.slice(8))}—{Number(e.endDate.slice(8))}日
                    </span>
                  )}
                  <span className="shrink-0 rounded bg-stone-100 px-1 py-px text-[10px] text-stone-400">
                    {c.label}
                  </span>
                </div>
              </button>
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-200 px-3 py-8 text-center text-xs leading-6 text-stone-300">
            对着左侧说一句话，或点 + 手动添加
            {props.onSeedDemo && events.length === 0 && (
              <button
                onClick={props.onSeedDemo}
                className="mx-auto mt-2 block text-stone-400 underline underline-offset-4 hover:text-stone-600"
              >
                先载入几条示例日程看看效果
              </button>
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
