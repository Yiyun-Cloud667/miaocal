import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DiaryEntry } from '@/types/diary'
import { MOODS, moodOf } from '@/types/diary'
import { useSpeech } from '@/hooks/useSpeech'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 日记编辑器：心情 + 语音听写 + 自动保存 */
export default function DiaryPanel(props: {
  iso: string
  entry: DiaryEntry | undefined
  onSave: (date: string, patch: { mood?: string; text?: string }) => void
}) {
  const { iso, entry, onSave } = props
  const [text, setText] = useState(entry?.text ?? '')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const d = new Date(iso + 'T00:00:00')

  // 切换日期时载入对应条目
  useEffect(() => {
    setText(entry?.text ?? '')
    setSaved('idle')
  }, [iso, entry?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(
    (nextText: string) => {
      setSaved('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        onSave(iso, { text: nextText })
        setSaved('saved')
      }, 600)
    },
    [iso, onSave],
  )

  const onChange = (v: string) => {
    setText(v)
    scheduleSave(v)
  }

  // 语音听写：识别结果追加到正文
  const { listening, interim, supported, toggle } = useSpeech(
    useCallback(
      (t: string) => {
        setText((prev) => {
          const next = prev ? prev.replace(/\s+$/, '') + '，' + t : t
          scheduleSave(next)
          return next
        })
      },
      [scheduleSave],
    ),
  )

  const mood = entry?.mood ?? ''
  const moodInfo = moodOf(mood)
  const isToday = iso === (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` })()

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-xs tracking-widest text-stone-400">
        {isToday ? '今日手记' : '当日手记'}
      </div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-serif-cn text-2xl text-[#0F1326]">
          {d.getMonth() + 1}月{d.getDate()}日
        </span>
        <span className="text-sm text-stone-400">{WEEK[d.getDay()]}</span>
        {moodInfo && <span className="text-base">{moodInfo.emoji}</span>}
      </div>

      {/* 心情选择 */}
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] text-stone-400">今天心情如何</div>
        <div className="flex gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m.key}
              title={m.label}
              onClick={() => onSave(iso, { mood: mood === m.key ? '' : m.key })}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-all ${
                mood === m.key
                  ? 'scale-110 bg-white shadow-sm ring-2 ring-offset-1'
                  : 'opacity-50 hover:bg-white/70 hover:opacity-100'
              }`}
              style={mood === m.key ? ({ '--tw-ring-color': m.color } as CSSProperties) : {}}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 正文 */}
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="记录今天发生的事、想到的东西… 也可以点下方麦克风直接说"
        className="min-h-[160px] flex-1 resize-none rounded-xl border border-stone-200 bg-white/80 p-3 text-sm leading-6 text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-400"
      />

      {interim && (
        <div className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
          {interim}…
        </div>
      )}

      {/* 底栏：字数 / 保存状态 / 语音听写 */}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
        <span>{text.length} 字</span>
        <span className={saved === 'saved' ? 'text-emerald-600' : ''}>
          {saved === 'saving' ? '保存中…' : saved === 'saved' ? '已自动保存' : ''}
        </span>
        <button
          onClick={toggle}
          disabled={!supported}
          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-colors ${
            listening
              ? 'bg-rose-500 text-white'
              : 'bg-[#0F1326] text-stone-50 hover:bg-[#232a45]'
          } ${!supported ? 'opacity-40' : ''}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          {listening ? '听写中…' : '语音听写'}
        </button>
      </div>
    </div>
  )
}
