import { useCallback, useState } from 'react'
import type { ParsedDraft } from '@/types/event'
import { parseSchedule, COLOR_PALETTE } from '@/lib/parser'
import { useSpeech } from '@/hooks/useSpeech'

const EXAMPLES = [
  '明天下午3点到5点开项目评审会',
  '9月10号到9月15号出差去深圳',
  '下周三上午体检',
  '今晚8点陪家人吃饭',
]

export default function VoiceBar(props: {
  onCommit: (draft: ParsedDraft, source: 'voice' | 'manual') => void
}) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<ParsedDraft | null>(null)
  const [source, setSource] = useState<'voice' | 'manual'>('manual')
  const [failed, setFailed] = useState('')

  const handleText = useCallback((t: string, src: 'voice' | 'manual') => {
    setText(t)
    setSource(src)
    const d = parseSchedule(t)
    if (d) {
      setDraft(d)
      setFailed('')
    } else {
      setDraft(null)
      setFailed('没有听出时间信息，可以带上「明天 / 周几 / 几月几号」再说一次')
    }
  }, [])

  const { listening, interim, supported, toggle } = useSpeech(
    useCallback((t: string) => handleText(t, 'voice'), [handleText]),
  )

  const commit = () => {
    if (!draft) return
    props.onCommit(draft, source)
    setDraft(null)
    setText('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* 墨爪 Noir · 品牌 IP 语音助手 */}
      <div className="mb-4 flex items-center gap-3">
        <img
          src="./mascot.png"
          alt="墨爪 Noir"
          className="h-12 w-12 rounded-full bg-[#FFEEDB] p-1 ring-1 ring-orange-200"
        />
        <div>
          <div className="text-xs tracking-widest text-stone-400">墨爪 Noir · 语音小助手</div>
          <div className="font-serif-cn whitespace-nowrap text-lg text-[#0F1326]">说一句，就安排上</div>
        </div>
      </div>

      {/* 麦克风 */}
      <div className="mb-4 flex flex-col items-center">
        <button
          onClick={toggle}
          disabled={!supported}
          aria-label="语音输入"
          className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all ${
            listening
              ? 'bg-[#FF5C7A] text-white shadow-lg shadow-orange-200'
              : 'bg-[#FF8A00] text-white hover:bg-[#f07d00] shadow-lg shadow-orange-200/60'
          } ${!supported ? 'opacity-40' : ''}`}
        >
          {listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#FF8A00] opacity-30" />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <div className="mt-2 text-[11px] text-stone-400">
          {!supported
            ? '当前环境不支持语音识别，可直接键盘输入'
            : listening
              ? '正在聆听… 说完自动识别'
              : '点一下，说出你的安排'}
        </div>
      </div>

      {/* 文本输入 */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setDraft(null); setFailed('') }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) handleText(text.trim(), 'manual')
          }}
          placeholder='也可以打字，例如「周五下午3点见客户」'
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-stone-400"
        />
        <button
          onClick={() => text.trim() && handleText(text.trim(), 'manual')}
          className="shrink-0 rounded-xl bg-[#0F1326] px-3 text-sm text-stone-50 hover:bg-[#232a45]"
        >
          解析
        </button>
      </div>

      {interim && (
        <div className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
          {interim}…
        </div>
      )}

      {/* 解析预览 */}
      {draft && (
        <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-stone-400">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: COLOR_PALETTE[draft.color].dot }}
            />
            已识别 · 确认后写入日历
          </div>
          <div className="text-sm font-medium text-[#0F1326]">{draft.title}</div>
          <div className="mt-1 text-xs text-stone-500">{draft.summary}</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={commit}
              className="flex-1 rounded-lg bg-[#0F1326] py-2 text-sm text-stone-50 hover:bg-[#232a45]"
            >
              确认添加
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg px-3 py-2 text-sm text-stone-400 hover:bg-stone-100"
            >
              取消
            </button>
          </div>
        </div>
      )}
      {failed && <div className="mt-3 text-xs text-amber-600">{failed}</div>}

      {/* 示例 */}
      <div className="mt-auto pt-6">
        <div className="mb-2 text-[11px] text-stone-400">试试这样说</div>
        <div className="space-y-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => handleText(ex, 'manual')}
              className="block w-full rounded-lg border border-stone-100 bg-white/60 px-3 py-2 text-left text-xs text-stone-500 transition-colors hover:border-stone-200 hover:text-stone-700"
            >
              “{ex}”
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
