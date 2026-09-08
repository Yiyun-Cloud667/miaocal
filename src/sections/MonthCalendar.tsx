import { useMemo } from 'react'
import type { CalEvent } from '@/types/event'
import { COLOR_PALETTE, toISODate } from '@/lib/parser'
import { occurrencesInRange } from '@/lib/recur'
import { holidayOf, isMajorHoliday } from '@/lib/holidays'

interface DayCell {
  iso: string
  day: number
  inMonth: boolean
  holiday?: string
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function buildWeeks(year: number, month: number): DayCell[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // 周一开头
  const start = new Date(year, month, 1 - offset)
  const weeks: DayCell[][] = []
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      const iso = toISODate(date)
      week.push({ iso, day: date.getDate(), inMonth: date.getMonth() === month, holiday: holidayOf(iso) })
    }
    weeks.push(week)
  }
  // 最后一行整行不在本月则裁掉
  if (weeks[5].every((c) => !c.inMonth)) weeks.pop()
  return weeks
}

interface Segment {
  event: CalEvent
  colStart: number
  colEnd: number
  isStart: boolean
  isEnd: boolean
}

const MAX_LANES = 2

export default function MonthCalendar(props: {
  year: number
  month: number
  events: CalEvent[]
  selectedISO: string
  onSelectDay: (iso: string) => void
  onOpenEvent: (e: CalEvent) => void
  /** 日期 → 心情颜色（有日记的日期在右上角打标记点） */
  diaryDots?: Record<string, string>
}) {
  const { year, month, events, selectedISO } = props
  const weeks = useMemo(() => buildWeeks(year, month), [year, month])
  const todayISOstr = toISODate(new Date())

  /** 每周的跨天条布局：事件 → 泳道 */
  const weekLanes = useMemo(() => {
    return weeks.map((week) => {
      const wStart = week[0].iso
      const wEnd = week[6].iso
      // 普通事件按区间切段；重复事件按本周命中日展开为单日段
      interface SegInput { ev: CalEvent; colStart: number; colEnd: number; isStart: boolean; isEnd: boolean; sortKey: string }
      const inputs: SegInput[] = []
      for (const ev of events) {
        if (ev.recur) {
          // 本周命中日 → 连续天合并为一条（每天重复的事件一周只占一条泳道）
          const cols = occurrencesInRange(ev, wStart, wEnd)
            .map((iso) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(wStart + 'T00:00:00').getTime()) / 86400000))
            .filter((c) => c >= 0 && c <= 6)
            .sort((a, b) => a - b)
          let runStart = -1
          let prev = -2
          const runs: Array<[number, number]> = []
          for (const c of cols) {
            if (c !== prev + 1) {
              if (runStart >= 0) runs.push([runStart, prev])
              runStart = c
            }
            prev = c
          }
          if (runStart >= 0) runs.push([runStart, prev])
          for (const [cs, ce] of runs) {
            const iso = toISODate(new Date(new Date(wStart + 'T00:00:00').getTime() + cs * 86400000))
            inputs.push({ ev, colStart: cs, colEnd: ce, isStart: true, isEnd: true, sortKey: iso })
          }
        } else if (ev.startDate <= wEnd && ev.endDate >= wStart) {
          const colStart = Math.max(0, Math.ceil((new Date(ev.startDate + 'T00:00:00').getTime() - new Date(wStart + 'T00:00:00').getTime()) / 86400000))
          const colEnd = Math.min(6, Math.ceil((new Date(ev.endDate + 'T00:00:00').getTime() - new Date(wStart + 'T00:00:00').getTime()) / 86400000))
          inputs.push({
            ev,
            colStart,
            colEnd,
            isStart: ev.startDate >= wStart,
            isEnd: ev.endDate <= wEnd,
            sortKey: ev.startDate,
          })
        }
      }
      inputs.sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1
        return b.colEnd - b.colStart - (a.colEnd - a.colStart)
      })
      const lanes: Segment[][] = []
      const overflowPerCol = new Array(7).fill(0)
      for (const inp of inputs) {
        const seg: Segment = {
          event: inp.ev,
          colStart: inp.colStart,
          colEnd: inp.colEnd,
          isStart: inp.isStart,
          isEnd: inp.isEnd,
        }
        let placed = false
        for (let l = 0; l < MAX_LANES; l++) {
          lanes[l] = lanes[l] ?? []
          if (lanes[l].every((s) => s.colEnd < seg.colStart || seg.colEnd < s.colStart)) {
            lanes[l].push(seg)
            placed = true
            break
          }
        }
        if (!placed) for (let c = seg.colStart; c <= seg.colEnd; c++) overflowPerCol[c]++
      }
      return { lanes, overflowPerCol }
    })
  }, [weeks, events])

  return (
    <div className="select-none">
      {/* 星期表头 */}
      <div className="grid grid-cols-7 pb-2">
        {WEEK_LABELS.map((w, i) => (
          <div key={w} className={`text-center text-xs tracking-widest ${i >= 5 ? 'text-rose-400/80' : 'text-stone-400'}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200/80">
        {weeks.map((week, wi) => (
          <div key={wi} className="border-b border-stone-200/80">
            {/* 日期行 */}
            <div className="grid grid-cols-7">
              {week.map((cell) => {
                const isToday = cell.iso === todayISOstr
                const isSelected = cell.iso === selectedISO
                return (
                  <button
                    key={cell.iso}
                    onClick={() => props.onSelectDay(cell.iso)}
                    className={`relative flex h-14 flex-col items-center pt-1 transition-colors ${
                      isSelected ? 'bg-stone-100/80' : 'hover:bg-stone-50'
                    }`}
                  >
                    {props.diaryDots?.[cell.iso] && (
                      <span
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                        title="这一天有手记"
                        style={{ backgroundColor: props.diaryDots[cell.iso] }}
                      />
                    )}
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm leading-none ${
                        isToday
                          ? 'bg-[#0F1326] text-stone-50 font-medium'
                          : cell.inMonth
                            ? 'text-stone-700'
                            : 'text-stone-300'
                      }`}
                    >
                      {cell.day}
                    </span>
                    <span
                      className={`mt-0.5 block h-4 w-full truncate text-center text-[10px] leading-4 ${
                        isMajorHoliday(cell.holiday) ? 'text-rose-500' : 'text-stone-400'
                      } ${cell.inMonth ? '' : 'opacity-50'}`}
                    >
                      {cell.holiday ?? ''}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 事件条泳道 */}
            {weekLanes[wi].lanes.map((lane, li) => (
              <div key={li} className="grid grid-cols-7 gap-x-[3px] px-[3px] pb-1">
                {lane.map((seg) => {
                  const c = COLOR_PALETTE[seg.event.color] ?? COLOR_PALETTE.default
                  return (
                    <button
                      key={seg.event.id + '-' + wi + '-' + li}
                      onClick={() => props.onOpenEvent(seg.event)}
                      title={seg.event.title}
                      className={`h-[22px] truncate px-2 text-left text-[11px] leading-[22px] transition-opacity hover:opacity-80 ${
                        seg.isStart ? 'rounded-l-md border-l-[3px]' : ''
                      } ${seg.isEnd ? 'rounded-r-md border-r-[3px]' : ''} ${seg.event.done ? 'opacity-45 line-through' : ''}`}
                      style={{
                        gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                        backgroundColor: c.soft,
                        borderLeftColor: seg.isStart ? c.bar : 'transparent',
                        borderRightColor: seg.isEnd ? c.bar : 'transparent',
                        color: c.text,
                      }}
                    >
                      {!seg.isStart && '▸ '}
                      {seg.event.recur && seg.isStart && '🔁 '}
                      {seg.event.title}
                    </button>
                  )
                })}
              </div>
            ))}

            {/* 溢出指示 */}
            {weekLanes[wi].overflowPerCol.some((n) => n > 0) && (
              <div className="grid grid-cols-7 px-[3px] pb-1">
                {weekLanes[wi].overflowPerCol.map((n, ci) =>
                  n > 0 ? (
                    <button
                      key={ci}
                      onClick={() => props.onSelectDay(week[ci].iso)}
                      className="pl-2 text-left text-[10px] text-stone-400 hover:text-stone-600"
                      style={{ gridColumn: `${ci + 1}` }}
                    >
                      还有 {n} 项
                    </button>
                  ) : (
                    <span key={ci} />
                  ),
                )}
              </div>
            )}
            {weekLanes[wi].lanes.length === 0 && <div className="pb-2" />}
          </div>
        ))}
      </div>
    </div>
  )
}
