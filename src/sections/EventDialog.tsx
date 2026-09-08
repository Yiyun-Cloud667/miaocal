import { useEffect, useState } from 'react'
import type { CalEvent } from '@/types/event'
import { COLOR_PALETTE, pickColor } from '@/lib/parser'
import { recurLabel } from '@/lib/recur'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function EventDialog(props: {
  open: boolean
  /** null = 新建 */
  event: CalEvent | null
  defaultDate: string
  onClose: () => void
  onSave: (patch: {
    id?: string
    title: string
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    color: string
  }) => void
  onDelete?: (id: string) => void
}) {
  const { open, event, defaultDate } = props
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [color, setColor] = useState('default')

  useEffect(() => {
    if (!open) return
    if (event) {
      setTitle(event.title)
      setStartDate(event.startDate)
      setEndDate(event.endDate)
      setStartTime(event.startTime)
      setEndTime(event.endTime)
      setColor(event.color)
    } else {
      setTitle('')
      setStartDate(defaultDate)
      setEndDate(defaultDate)
      setStartTime('')
      setEndTime('')
      setColor('default')
    }
  }, [open, event, defaultDate])

  const save = () => {
    const t = title.trim()
    if (!t || !startDate) return
    const [s, e] = endDate >= startDate ? [startDate, endDate] : [endDate, startDate]
    props.onSave({
      id: event?.id,
      title: t,
      startDate: s,
      endDate: e,
      startTime,
      endTime,
      color: color === 'default' ? pickColor(t) : color,
    })
    props.onClose()
  }

  const inputCls =
    'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-stone-200 bg-[#fafaf8]">
        <DialogHeader>
          <DialogTitle className="font-serif-cn text-lg text-[#0F1326]">
            {event ? '编辑日程' : '新建日程'}
          </DialogTitle>
          {event?.recur && (
            <div className="text-xs text-stone-400">
              🔁 {recurLabel(event.recur)}重复 · 修改将应用于整个系列
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <input
            className={inputCls}
            placeholder="要做什么？"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-stone-400">开始日期</span>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-stone-400">结束日期</span>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-stone-400">开始时间（留空为全天）</span>
              <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-stone-400">结束时间</span>
              <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] text-stone-400">配色（默认按内容自动识别）</span>
            <div className="flex gap-2">
              {Object.entries(COLOR_PALETTE).map(([key, c]) => (
                <button
                  key={key}
                  title={c.label}
                  onClick={() => setColor(key)}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === key ? 'scale-110 ring-2 ring-stone-400 ring-offset-2' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.bar }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {event ? (
              <button
                onClick={() => { props.onDelete?.(event.id); props.onClose() }}
                className="text-xs text-rose-500 hover:text-rose-600"
              >
                删除此日程
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={props.onClose}
                className="rounded-lg px-4 py-2 text-sm text-stone-500 hover:bg-stone-100"
              >
                取消
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-[#0F1326] px-4 py-2 text-sm text-stone-50 hover:bg-[#232a45]"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
