import type { CalEvent } from '@/types/event'
import { toISODate, COLOR_PALETTE } from '@/lib/parser'
import { eventsOnDay } from '@/hooks/useEvents'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * 桌面小组件预览：模拟 Electron 桌面挂件（widget 模式）的两种形态
 * 1) 迷你月历 —— 有日程的日期打点
 * 2) 今日待办 —— 列表形态
 */
export default function WidgetPreview(props: {
  open: boolean
  onClose: () => void
  events: CalEvent[]
}) {
  const { events } = props
  const now = new Date()
  const today = toISODate(now)
  const y = now.getFullYear()
  const m = now.getMonth()

  // 迷你月历数据
  const first = new Date(y, m, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: Array<{ day: number; iso: string } | null> = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: toISODate(new Date(y, m, d)) })
  }
  const dotFor = (iso: string) => {
    const evs = eventsOnDay(events, iso).filter((e) => !e.done)
    return evs.length > 0 ? (COLOR_PALETTE[evs[0].color] ?? COLOR_PALETTE.default).dot : null
  }

  const todayEvents = eventsOnDay(events, today)

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-2xl border-stone-700 bg-[#0F1326] text-stone-200">
        <DialogHeader>
          <DialogTitle className="font-serif-cn text-stone-100">
            桌面小组件预览 <span className="ml-2 text-xs font-normal text-stone-500">打包为桌面应用后可常驻桌面</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-5 p-1">
          {/* 形态一：迷你月历 */}
          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-stone-300">{m + 1}月</span>
              <span className="text-[10px] tracking-widest text-stone-500">日历模式</span>
            </div>
            <div className="grid grid-cols-7 gap-y-1.5 text-center">
              {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                <span key={w} className="text-[9px] text-stone-500">{w}</span>
              ))}
              {cells.map((c, i) =>
                c ? (
                  <div key={i} className="flex flex-col items-center">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                        c.iso === today ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-400'
                      }`}
                    >
                      {c.day}
                    </span>
                    <span
                      className="mt-0.5 h-1 w-1 rounded-full"
                      style={{ backgroundColor: dotFor(c.iso) ?? 'transparent' }}
                    />
                  </div>
                ) : (
                  <span key={i} />
                ),
              )}
            </div>
          </div>

          {/* 形态二：今日待办 */}
          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-stone-300">
                今日 · {now.getMonth() + 1}/{now.getDate()}
              </span>
              <span className="text-[10px] tracking-widest text-stone-500">待办模式</span>
            </div>
            <div className="space-y-2">
              {todayEvents.length === 0 && (
                <div className="py-6 text-center text-[11px] text-stone-500">今天暂无安排</div>
              )}
              {todayEvents.slice(0, 5).map((e) => {
                const c = COLOR_PALETTE[e.color] ?? COLOR_PALETTE.default
                return (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
                    <span className={`truncate text-xs ${e.done ? 'text-stone-600 line-through' : 'text-stone-300'}`}>
                      {e.title}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-stone-500">
                      {e.startTime || '全天'}
                    </span>
                  </div>
                )
              })}
              {todayEvents.length > 5 && (
                <div className="text-[10px] text-stone-500">还有 {todayEvents.length - 5} 项…</div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
