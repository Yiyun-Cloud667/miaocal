/**
 * 中文自然语言日程解析引擎
 * 组合策略：chrono-node 中文解析器 + 自定义规则（上午/下午/晚上时段、
 * “A到B”区间合并、时间点区间、标题抽取、语义配色）
 */
import * as chrono from 'chrono-node'
import type { ParsedDraft } from '@/types/event'

const zh = chrono.zh.hans

/* ---------- 工具 ---------- */

function pad(n: number) {
  return String(n).padStart(2, '0')
}
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function sameDay(a: Date, b: Date) {
  return toISODate(a) === toISODate(b)
}
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/* ---------- 语义配色 ---------- */

export const COLOR_PALETTE: Record<
  string,
  { label: string; bar: string; soft: string; dot: string; text: string }
> = {
  // 顽皮猫品牌色系：科技蓝 / 活力橙 / 探索紫 / 深夜蓝 / 暖橙红
  work:   { label: '工作', bar: '#2563EB', soft: '#E4EBFA', dot: '#2563EB', text: '#1E4FC2' },
  travel: { label: '出行', bar: '#FF8A00', soft: '#FFEEDB', dot: '#FF8A00', text: '#B96A00' },
  health: { label: '健康', bar: '#7C3AED', soft: '#EDE8FF', dot: '#7C3AED', text: '#5E2EC0' },
  social: { label: '生活', bar: '#FF5C7A', soft: '#FFE3E8', dot: '#FF5C7A', text: '#D13D5B' },
  study:  { label: '学习', bar: '#0F1326', soft: '#E7E9F2', dot: '#0F1326', text: '#0F1326' },
  default:{ label: '日程', bar: '#8A93A6', soft: '#EDEFF4', dot: '#8A93A6', text: '#5A6274' },
}

const COLOR_RULES: Array<[RegExp, string]> = [
  [/会议|开会|评审|汇报|面试|客户|周报|站会|工作|加班|述职|谈(判|合作)/, 'work'],
  [/出差|旅行|旅游|机票|高铁|火车|航班|飞|酒店|度假|返程|接机|送机/, 'travel'],
  [/健身|跑步|运动|瑜伽|游泳|体检|看病|医院|复诊|牙医|牙科|锻炼|打球/, 'health'],
  [/生日|聚会|聚餐|吃饭|约会|婚礼|派对|看电影|逛街|陪|家人/, 'social'],
  [/学习|读书|看书|课程|考试|复习|论文|作业|上课|培训|讲座|自习/, 'study'],
]

export function pickColor(title: string): string {
  for (const [re, key] of COLOR_RULES) if (re.test(title)) return key
  return 'default'
}

/* ---------- 时段默认时刻 ---------- */

const SLOT: Record<string, [string, string]> = {
  凌晨: ['05:00', '07:00'],
  早上: ['07:00', '09:00'],
  早晨: ['07:00', '09:00'],
  上午: ['09:00', '12:00'],
  中午: ['12:00', '14:00'],
  下午: ['14:00', '18:00'],
  傍晚: ['17:00', '19:00'],
  晚上: ['19:00', '22:00'],
  今晚: ['19:00', '22:00'],
  全天: ['', ''],
}

/* ---------- 时间点区间：下午3点到5点 ---------- */

interface TimeRange {
  start: string
  end: string
  /** 命中的原始文本（用于从标题中剔除） */
  text: string
  index: number
}

function extractClockRange(text: string): TimeRange | null {
  const re =
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*(?:[:：点])\s*(\d{1,2}|半)?\s*分?\s*(?:到|至|~|～|—|–|-)\s*(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*(?:[:：点])\s*(\d{1,2}|半)?\s*分?/
  const m = re.exec(text)
  if (!m) return null
  const toHM = (mer: string | undefined, h: string, min: string | undefined, isEnd: boolean) => {
    let hh = Number(h)
    let mm = min === '半' ? 30 : min ? Number(min) : 0
    if (mer && /下午|傍晚|晚上/.test(mer) && hh < 12) hh += 12
    if (mer && /中午/.test(mer) && hh < 11) hh += 12
    if (!mer && !isEnd && /下午|傍晚|晚上/.test(m[1] ?? '') && hh < 12) hh += 12
    return `${pad(hh)}:${pad(mm)}`
  }
  const start = toHM(m[1], m[2], m[3], false)
  const end = toHM(m[4] ?? m[1], m[5], m[6], true)
  return { start, end, text: m[0], index: m.index }
}

/** 单时间点：下午3点 / 15:30 */
function extractClock(text: string): TimeRange | null {
  const re = /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)\s*(\d{1,2})\s*(?:[:：点])\s*(\d{1,2}|半)?\s*分?|(\d{1,2})\s*[:：]\s*(\d{2})/
  const m = re.exec(text)
  if (!m) return null
  let hh: number, mm: number
  if (m[4] !== undefined) {
    hh = Number(m[4]); mm = Number(m[5])
  } else {
    hh = Number(m[2]); mm = m[3] === '半' ? 30 : m[3] ? Number(m[3]) : 0
    if (/下午|傍晚|晚上/.test(m[1]) && hh < 12) hh += 12
    if (/中午/.test(m[1]) && hh < 11) hh += 12
  }
  return { start: `${pad(hh)}:${pad(mm)}`, end: '', text: m[0], index: m.index }
}

/** 裸时段词（无具体钟点）：明天上午 / 9月10号晚上 */
function extractSlot(text: string): { key: string; text: string; index: number } | null {
  const re = /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|全天)/
  const m = re.exec(text)
  if (!m) return null
  return { key: m[1], text: m[0], index: m.index }
}

/* ---------- 标题抽取 ---------- */

const FILLER =
  /^(?:嗯|那个|就是|然后呢?|帮我把|帮我|麻烦|请|我要|我想|我得|我需要|我打算|我计划|记得|提醒我|到时候提醒我|安排一下|安排|记录一下|记一下|新增|添加|加个|有一个|有个|有|去|说|可能|大概|差不多)[，,。.\s]*/

function cleanTitle(text: string, removals: string[]): string {
  let t = text
  // 剔除已识别的时间片段（按长度降序，避免子串冲突；同时尝试 trim 版本）
  const all = [...new Set(removals.flatMap((r) => [r, r.trim()]).filter(Boolean))]
  for (const r of all.sort((a, b) => b.length - a.length)) {
    t = t.split(r).join(' ')
  }
  t = t.replace(/从|起|开始|为止|结束/g, ' ')
  let prev = ''
  while (prev !== t) {
    prev = t
    t = t.trim().replace(FILLER, '')
  }
  t = t.replace(/^(?:的|要|得|去)+/, '').replace(/[，,。.\s]+$/, '').trim()
  t = t.replace(/\s{2,}/g, ' ')
  return t
}

/* ---------- 星期表达式（chrono 对“周五晚上”等组合不稳，自处理） ---------- */

const WEEKDAY_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
}

function extractWeekday(text: string, ref: Date): { date: Date; text: string } | null {
  const re = /(下下个|下个|下个|下|这|这个|本|上)?\s*(?:周|星期|礼拜)([一二三四五六日天1-7])/
  const m = re.exec(text)
  if (!m) return null
  const num = WEEKDAY_NUM[m[2]]
  const refDow = (ref.getDay() + 6) % 7 // 周一=0
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - refDow)
  let weekOffset = 0
  if (/下下个|下下/.test(m[1] ?? '')) weekOffset = 2
  else if (/下/.test(m[1] ?? '')) weekOffset = 1
  else if (/上/.test(m[1] ?? '')) weekOffset = -1
  let d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekOffset * 7 + (num - 1))
  // 无前缀且已过去 → 顺延到下周
  if (!m[1]) {
    const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    if (d < todayStart) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  }
  return { date: d, text: m[0] }
}

function normalize(text: string): string {
  return text
    .replace(/今晚/g, '今天晚上')
    .replace(/明晚/g, '明天晚上')
    .replace(/明儿/g, '明天')
}

/* ---------- 重复规则：每周五 / 每天 / 每月15号 ---------- */

function extractRecur(
  text: string,
  ref: Date,
): { recur: import('@/types/event').Recur; start: Date; text: string } | null {
  let m = /每(?:个)?(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(text)
  if (m) {
    const num = WEEKDAY_NUM[m[1]]
    const refDow = (ref.getDay() + 6) % 7
    const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - refDow)
    let d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (num - 1))
    const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    if (d < todayStart) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
    return { recur: { freq: 'weekly', byDay: num }, start: d, text: m[0] }
  }
  m = /每(?:个)?月\s*(\d{1,2})\s*[号日]/.exec(text)
  if (m) {
    const day = Math.min(31, Number(m[1]))
    let d = new Date(ref.getFullYear(), ref.getMonth(), day)
    const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    if (d < todayStart) d = new Date(ref.getFullYear(), ref.getMonth() + 1, day)
    return { recur: { freq: 'monthly', byDay: day }, start: d, text: m[0] }
  }
  m = /每(?:个)?(?:天|日)/.exec(text)
  if (m) {
    return {
      recur: { freq: 'daily' },
      start: new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()),
      text: m[0],
    }
  }
  return null
}

/* ---------- 主入口 ---------- */

export function parseSchedule(inputRaw: string, refDate: Date = new Date()): ParsedDraft | null {
  const text = normalize(inputRaw.trim())
  if (!text) return null

  const matchedTexts: string[] = []
  let startTime = ''
  let endTime = ''

  // 1) 先由自定义规则接管“日内时刻”，chrono 只负责日期
  let rest = text
  const remove = (s: string) => { rest = rest.replace(s, ' ') }

  // 0) 重复规则（每周五 / 每天 / 每月15号）
  const recurHit = extractRecur(rest, refDate)
  let recur: import('@/types/event').Recur | undefined
  let recurStart: Date | null = null
  if (recurHit) {
    recur = recurHit.recur
    recurStart = recurHit.start
    matchedTexts.push(recurHit.text)
    remove(recurHit.text)
  }

  const clockRange = extractClockRange(rest)
  const clock = clockRange ?? extractClock(rest)
  if (clock) {
    startTime = clock.start
    endTime = clock.end
    matchedTexts.push(clock.text)
    remove(clock.text)
  } else {
    const slot = extractSlot(rest)
    if (slot) {
      const [s, e] = SLOT[slot.key]
      startTime = s
      endTime = e
      matchedTexts.push(slot.text)
      remove(slot.text)
    }
  }

  // 2) 星期表达式（如 下周三 / 周五）
  const weekday = extractWeekday(rest, refDate)
  let weekdayDate: Date | null = null
  if (weekday) {
    weekdayDate = weekday.date
    matchedTexts.push(weekday.text)
    remove(weekday.text)
  }

  // 2.5) 同月简写区间：“9月10号到15号”
  let monthRange: { start: Date; end: Date; text: string } | null = null
  {
    const re = /(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]\s*(?:到|至|~|～|—|–|-)\s*(\d{1,2})\s*[号日]/
    const m = re.exec(rest)
    if (m) {
      const month = Number(m[1]) - 1
      let year = refDate.getFullYear()
      // 月份已过去较多 → 视为明年（forward 语义）
      if (month < refDate.getMonth() - 1) year += 1
      monthRange = {
        start: new Date(year, month, Number(m[2])),
        end: new Date(year, month, Number(m[3])),
        text: m[0],
      }
      matchedTexts.push(m[0])
      remove(m[0])
    }
  }

  // 3) chrono 解析日期（rest 已剥离时刻与星期）
  const results = zh.parse(rest, refDate, { forwardDate: true })
  let startD: Date | null = null
  let endD: Date | null = null

  if (monthRange) {
    startD = monthRange.start
    endD = monthRange.end
  } else if (results.length > 0) {
    startD = results[0].start.date()
    endD = results[0].end ? results[0].end.date() : null
    matchedTexts.push(results[0].text)
    if (results.length > 1) {
      const between = rest.slice(
        results[0].index + results[0].text.length,
        results[1].index,
      )
      if (/^(?:\s*(?:到|至|直到|~|～|—|–|-)\s*)$/.test(between)) {
        endD = results[1].end ? results[1].end.date() : results[1].start.date()
        matchedTexts.push(between, results[1].text)
      }
    }
  } else if (weekdayDate) {
    startD = weekdayDate
  } else if (recurStart) {
    // 只有重复规则、没有显式日期 → 从下一次发生日开始
    startD = recurStart
  }

  if (!startD) return null

  // 重复事件归一为单日（从首次发生日开始）
  if (recur) {
    endD = null
  }

  // 4) chrono 命中的日期可能与自定义星期冲突 → 以星期为准（如“周五晚上”）
  if (weekdayDate && results.length > 0 && !sameDay(startD, weekdayDate)) {
    // 若 chrono 命中的不是完整日期（只是“明天”类），信任星期
    if (!results[0].start.isCertain('day') || !/[号日月]/.test(results[0].text)) {
      startD = weekdayDate
      if (endD) endD = weekdayDate
    }
  }

  // 5) 自定义时刻接管时，chrono 携带的跨日 end 归零（“下午3点到5点”被 chrono 误拉到次日）
  if (clockRange && endD && !sameDay(startD, endD)) {
    endD = null
  }

  if (endD && endD < startD) [startD, endD] = [endD, startD]

  // 6) chrono 自带确定时刻且我们没有解析出时刻（如“明晚8点”被规范化后已接管，此处兜底）
  if (!startTime && results[0]?.start.isCertain('hour')) {
    startTime = `${pad(startD.getHours())}:${pad(startD.getMinutes())}`
    if (endD && sameDay(startD, endD) && results[0].end?.isCertain('hour')) {
      endTime = `${pad(endD.getHours())}:${pad(endD.getMinutes())}`
    }
  }

  const startISO = toISODate(startD)
  const endISO = endD ? toISODate(endD) : startISO

  const title = cleanTitle(text, matchedTexts) || '未命名日程'

  const summary = buildSummary(startISO, endISO, startTime, endTime, recur)
  return {
    title,
    startDate: startISO,
    endDate: endISO,
    startTime,
    endTime,
    color: pickColor(title + text),
    recur,
    rawText: text,
    summary,
  }
}

function buildSummary(
  sISO: string,
  eISO: string,
  st: string,
  et: string,
  recur?: import('@/types/event').Recur,
): string {
  const s = new Date(sISO + 'T00:00:00')
  const e = new Date(eISO + 'T00:00:00')
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
  const dayPart =
    sISO === eISO ? fmt(s) : `${fmt(s)} — ${fmt(e)} · 共 ${Math.round((e.getTime() - s.getTime()) / 86400000) + 1} 天`
  const timePart = st ? (et ? `${st}–${et}` : `${st}`) : '全天'
  const recurPart = recur
    ? ` · 🔁 ${recur.freq === 'daily' ? '每天' : recur.freq === 'weekly' ? `每周${'一二三四五六日'[(recur.byDay ?? 1) - 1]}` : `每月${recur.byDay}号`}（首次 ${dayPart}）`
    : ''
  return recur ? `${timePart}${recurPart}` : `${dayPart} · ${timePart}`
}
