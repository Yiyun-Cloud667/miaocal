import { useEffect, useMemo, useState } from 'react'
import type { CalEvent, ParsedDraft } from '@/types/event'
import { useEvents, todayISO } from '@/hooks/useEvents'
import { useDiary } from '@/hooks/useDiary'
import { useReminders } from '@/hooks/useReminders'
import { moodOf } from '@/types/diary'
import { toISODate, COLOR_PALETTE } from '@/lib/parser'
import MonthCalendar from '@/sections/MonthCalendar'
import AgendaPanel from '@/sections/AgendaPanel'
import VoiceBar from '@/sections/VoiceBar'
import EventDialog from '@/sections/EventDialog'
import WidgetPreview from '@/sections/WidgetPreview'

function Logo() {
  return (
    <img
      src="./logo.png"
      alt="猫历 logo"
      className="h-9 w-9 rounded-[10px] ring-1 ring-stone-900/10"
    />
  )
}

export default function Home() {
  const { events, addFromDraft, updateEvent, removeEvent, toggleDone, seedDemo } = useEvents()
  const { entries: diaryEntries, saveEntry: saveDiary } = useDiary()
  const { enabled: notifyOn, enable: enableNotify, disable: disableNotify } = useReminders(events)
  const now = new Date()
  const [viewY, setViewY] = useState(now.getFullYear())
  const [viewM, setViewM] = useState(now.getMonth())
  const [selectedISO, setSelectedISO] = useState(todayISO())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)

  // 每分钟轻量重渲染，跨午夜自动更新“今天”
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const monthLabel = useMemo(() => `${viewY} 年 ${viewM + 1} 月`, [viewY, viewM])

  // 有手记的日期 → 心情颜色标记点
  const diaryDots = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [date, e] of Object.entries(diaryEntries)) {
      map[date] = moodOf(e.mood)?.color ?? '#c08b4e'
    }
    return map
  }, [diaryEntries])

  const shiftMonth = (delta: number) => {
    const d = new Date(viewY, viewM + delta, 1)
    setViewY(d.getFullYear())
    setViewM(d.getMonth())
  }

  const goToday = () => {
    const t = new Date()
    setViewY(t.getFullYear())
    setViewM(t.getMonth())
    setSelectedISO(todayISO())
  }

  const onCommit = (draft: ParsedDraft, source: 'voice' | 'manual') => {
    addFromDraft(draft, source)
    // 跳到事件所在月份并选中
    const d = new Date(draft.startDate + 'T00:00:00')
    setViewY(d.getFullYear())
    setViewM(d.getMonth())
    setSelectedISO(draft.startDate)
  }

  const openEvent = (e: CalEvent) => {
    setEditing(e)
    setDialogOpen(true)
  }

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const onSave = (p: {
    id?: string
    title: string
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    color: string
  }) => {
    if (p.id) {
      updateEvent(p.id, p)
    } else {
      onCommit({ ...p, rawText: '', summary: '' }, 'manual')
    }
  }

  const selectDay = (iso: string) => {
    setSelectedISO(iso)
    const d = new Date(iso + 'T00:00:00')
    if (d.getMonth() !== viewM || d.getFullYear() !== viewY) {
      setViewY(d.getFullYear())
      setViewM(d.getMonth())
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-[#0F1326]">
      {/* 顶栏 */}
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 pb-2 pt-6">
        <Logo />
        <div>
          <h1 className="font-serif-cn text-xl leading-tight tracking-wide">猫历</h1>
          <p className="text-[11px] tracking-widest text-stone-400">MIAOCAL · 说一句话，就安排好</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={async () => {
              if (notifyOn) {
                disableNotify()
              } else {
                const ok = await enableNotify()
                if (!ok) window.alert('通知权限未开启，请在浏览器/系统设置中允许通知')
              }
            }}
            title={notifyOn ? '提醒已开启（提前 10 分钟），点击关闭' : '开启日程提醒（提前 10 分钟通知）'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              notifyOn
                ? 'border-amber-200 bg-amber-50 text-amber-600'
                : 'border-stone-200 bg-white text-stone-400 hover:text-stone-600'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </button>
          <button
            onClick={() => setWidgetOpen(true)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700"
          >
            小组件预览
          </button>
          <button
            onClick={openNew}
            className="rounded-lg bg-[#0F1326] px-3.5 py-1.5 text-xs text-stone-50 hover:bg-[#232a45]"
          >
            + 新建日程
          </button>
        </div>
      </header>

      {/* 主体三栏 */}
      <main className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 pb-10 pt-4">
        {/* 左：语音助手 */}
        <aside className="col-span-3 rounded-2xl border border-stone-200/70 bg-[#faf9f7] p-5">
          <VoiceBar onCommit={onCommit} />
        </aside>

        {/* 中：月历 */}
        <section className="col-span-6 rounded-2xl border border-stone-200/70 bg-white/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif-cn text-lg text-[#0F1326]">{monthLabel}</h2>
            <div className="flex items-center gap-1 text-stone-400">
              <button onClick={() => shiftMonth(-1)} className="rounded-md px-2 py-1 hover:bg-stone-100" aria-label="上一月">
                ←
              </button>
              <button onClick={goToday} className="rounded-md px-2 py-1 text-xs hover:bg-stone-100">
                今天
              </button>
              <button onClick={() => shiftMonth(1)} className="rounded-md px-2 py-1 hover:bg-stone-100" aria-label="下一月">
                →
              </button>
            </div>
          </div>
          <MonthCalendar
            year={viewY}
            month={viewM}
            events={events}
            selectedISO={selectedISO}
            onSelectDay={selectDay}
            onOpenEvent={openEvent}
            diaryDots={diaryDots}
          />
          {/* 图例 */}
          <div className="mt-4 flex gap-4 border-t border-stone-100 pt-3">
            {Object.values(COLOR_PALETTE).map((c) => (
              <span key={c.label} className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.bar }} />
                {c.label}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-stone-300">配色由内容自动识别</span>
          </div>
        </section>

        {/* 右：当日待办 */}
        <aside className="col-span-3 rounded-2xl border border-stone-200/70 bg-[#faf9f7] p-5">
          <AgendaPanel
            iso={selectedISO}
            events={events}
            onToggleDone={toggleDone}
            onOpenEvent={openEvent}
            onSeedDemo={seedDemo}
            diaryEntry={diaryEntries[selectedISO]}
            onSaveDiary={saveDiary}
          />
        </aside>
      </main>

      <EventDialog
        open={dialogOpen}
        event={editing}
        defaultDate={selectedISO || toISODate(new Date())}
        onClose={() => setDialogOpen(false)}
        onSave={onSave}
        onDelete={removeEvent}
      />
      <WidgetPreview open={widgetOpen} onClose={() => setWidgetOpen(false)} events={events} />
    </div>
  )
}
