/**
 * 中文自然语言日程解析引擎（生产级）
 * 组合策略：chrono-node 中文解析器（日期） + 自研规则层：
 * 中文数字时刻、时段词、时刻区间、星期表达式、重复规则（每周/每天/每月/工作日/隔天）、
 * 持续天数（出差三天）、相对时间（半小时后）、标题抽取、语义配色
 */
import * as chrono from 'chrono-node'
import type { ParsedDraft, Recur } from '@/types/event'

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

/* ---------- 中文数字（0–99） ---------- */

const CN_DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

function cnNum(s: string): number | null {
  if (!s) return null
  if (/^\d+$/.test(s)) return Number(s)
  if (s === '十') return 10
  const m = /^([一二两三四五六七八九])?十([零一二三四五六七八九])?$/.exec(s)
  if (m) return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[2] ? CN_DIGIT[m[2]] : 0)
  if (s.length === 1 && s in CN_DIGIT) return CN_DIGIT[s]
  return null
}

/** 把时间语境里的中文数字转成阿拉伯数字（“三点半”→“3点半”，“一刻”→“15分”） */
function cnTimeToDigits(text: string): string {
  return text.replace(
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)?([零一二两三四五六七八九十]{1,3})点(半|一刻|([零一二两三四五六七八九十]{1,3})分)?/g,
    (all, mer, hCN, minPart, minCN) => {
      const h = cnNum(hCN)
      if (h === null || h > 24) return all
      let min = ''
      if (minPart === '半') min = '半'
      else if (minPart === '一刻') min = '15分'
      else if (minCN) {
        const mm = cnNum(minCN)
        if (mm === null) return all
        min = `${mm}分`
      }
      return `${mer ?? ''}${h}点${min}`
    },
  )
}

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
  [/会议|开会|评审|汇报|面试|客户|周报|站会|工作|加班|述职|谈(判|合作)|材料|报告|答辩/, 'work'],
  [/出差|旅行|旅游|机票|高铁|火车|航班|飞|酒店|度假|返程|接机|送机/, 'travel'],
  [/健身|跑步|运动|瑜伽|游泳|体检|看病|医院|复诊|牙医|牙科|锻炼|打球|吃药|午睡|喝水/, 'health'],
  [/生日|聚会|聚餐|吃饭|约会|婚礼|派对|看电影|逛街|陪|家人|孩子|妈妈|电话/, 'social'],
  [/学习|读书|看书|课程|考试|复习|论文|作业|上课|培训|讲座|自习|英语|图书馆/, 'study'],
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
  全天: ['', ''],
}

const MER_RE = /凌晨|早上|早晨|上午|中午|下午|傍晚|晚上/

function applyMeridiem(hh: number, mer: string | undefined): number {
  if (mer && /下午|傍晚|晚上/.test(mer) && hh < 12) return hh + 12
  if (mer && /中午/.test(mer) && hh < 11) return hh + 12
  return hh
}

/* ---------- 时刻提取 ---------- */

interface TimeRange {
  start: string
  end: string
  text: string
}

const MIN_RE = '(\\d{1,2}|半)'
const MIN_OPT = `(?:${MIN_RE}\\s*分?)?`

/** 时刻区间：下午3点到5点 / 九点到十一点半（已转阿拉伯） */
function extractClockRange(text: string): TimeRange | null {
  const re = new RegExp(
    `(${MER_RE.source})?\\s*(\\d{1,2})\\s*[:：点]\\s*${MIN_OPT}\\s*(?:到|至|~|～|—|–|-)\\s*(${MER_RE.source})?\\s*(\\d{1,2})\\s*[:：点]\\s*${MIN_OPT}`,
  )
  const m = re.exec(text)
  if (!m) return null
  const mm = (v: string | undefined) => (v === '半' ? 30 : v ? Number(v) : 0)
  let sh = applyMeridiem(Number(m[2]), m[1])
  let eh = Number(m[5])
  // 结束时刻未带时段 → 沿用开始时段
  eh = applyMeridiem(eh, m[4] ?? m[1])
  return {
    start: `${pad(sh)}:${pad(mm(m[3]))}`,
    end: `${pad(eh)}:${pad(mm(m[6]))}`,
    text: m[0],
  }
}

/** 单时刻：下午3点 / 15:30 / 十点前（截止） */
function extractClock(text: string): TimeRange | null {
  const re = new RegExp(
    `(${MER_RE.source})\\s*(\\d{1,2})\\s*[:：点]\\s*${MIN_OPT}(前|之前)?|(\\d{1,2})\\s*[:：]\\s*(\\d{2})`,
  )
  const m = re.exec(text)
  if (!m) return null
  let hh: number, mm: number
  if (m[5] !== undefined) {
    hh = Number(m[5]); mm = Number(m[6])
  } else {
    hh = applyMeridiem(Number(m[2]), m[1])
    mm = m[3] === '半' ? 30 : m[3] ? Number(m[3]) : 0
  }
  return { start: `${pad(hh)}:${pad(mm)}`, end: '', text: m[0] }
}

/** 裸时段词 / 双时段（上午和下午都） */
function extractSlot(text: string): { key: string; text: string } | null {
  const dual = new RegExp(`(${MER_RE.source})(?:和|与)(${MER_RE.source})(?:都|也)?`).exec(text)
  if (dual) return { key: dual[1], text: dual[0] }
  const m = new RegExp(`(${MER_RE.source}|全天)`).exec(text)
  if (!m) return null
  return { key: m[1], text: m[0] }
}

/* ---------- 相对时间：半小时后 / 两小时后 ---------- */

function extractRelative(text: string, ref: Date): { at: Date; text: string } | null {
  const m = /(半|([0-9]+)|([零一二两三四五六七八九十]{1,3}))(?:个)?(小时|钟头|分钟)后/.exec(text)
  if (!m) return null
  let amount: number | null = null
  if (m[1] === '半') amount = 0.5
  else if (m[2]) amount = Number(m[2])
  else if (m[3]) amount = cnNum(m[3])
  if (amount === null) return null
  const mins = /分钟/.test(m[4]) ? amount : amount * 60
  const at = new Date(ref.getTime() + Math.round(mins) * 60000)
  return { at, text: m[0] }
}

/* ---------- 持续天数：出差三天 / 连续加班五天 / 为期一周 ---------- */

function extractDuration(text: string): { days: number; text: string } | null {
  let m = /(?:持续|连续|为期|共)\s*([0-9]+|[零一二两三四五六七八九十]{1,3})\s*(天|日|周|星期)/.exec(text)
  if (!m) m = /([0-9]+|[零一二两三四五六七八九十]{1,3})\s*天(?!后)/.exec(text)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : cnNum(m[1])
  if (!n) return null
  const unit = m[2] ?? '天'
  const days = /周|星期/.test(unit) ? n * 7 : n
  return { days, text: m[0] }
}

/** 裸「N天后」：三天后交报告 */
function extractDaysLater(text: string): { days: number; text: string } | null {
  const m = /([0-9]+|[零一二两三四五六七八九十]{1,3})\s*天后/.exec(text)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : cnNum(m[1])
  return n ? { days: n, text: m[0] } : null
}

/* ---------- 星期表达式 ---------- */

const WEEKDAY_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
}

function extractWeekday(text: string, ref: Date): { date: Date; text: string } | null {
  const re = /(下下个|下下|下个|下|这|这个|本|上)?\s*(?:周|星期|礼拜)([一二三四五六日天1-7])/
  const m = re.exec(text)
  if (!m) return null
  const num = WEEKDAY_NUM[m[2]]
  const refDow = (ref.getDay() + 6) % 7
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - refDow)
  let weekOffset = 0
  if (/下下个|下下/.test(m[1] ?? '')) weekOffset = 2
  else if (/下/.test(m[1] ?? '')) weekOffset = 1
  else if (/上/.test(m[1] ?? '')) weekOffset = -1
  let d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekOffset * 7 + (num - 1))
  if (!m[1]) {
    const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    if (d < todayStart) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  }
  return { date: d, text: m[0] }
}

/* ---------- 重复规则 ---------- */

function extractRecur(
  text: string,
  ref: Date,
): { recur: Recur; start: Date; text: string } | null {
  // 每个工作日
  let m = /每(?:个)?(?:一)?个?工作日/.exec(text)
  if (m) {
    const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    let d = new Date(todayStart)
    const dow = (d.getDay() + 6) % 7 + 1
    if (dow > 5) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (8 - dow))
    return { recur: { freq: 'weekly', byDay: [1, 2, 3, 4, 5] }, start: d, text: m[0] }
  }
  // 每隔 N 天 / 隔天
  m = /每隔\s*([0-9]+|[零一二两三四五六七八九十]{1,3})\s*天|隔天|隔一天/.exec(text)
  if (m) {
    let n = 2
    if (m[1]) n = (/^\d+$/.test(m[1]) ? Number(m[1]) : cnNum(m[1]) ?? 1) + 1
    return {
      recur: { freq: 'interval', byDay: n },
      start: new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()),
      text: m[0],
    }
  }
  m = /每(?:个)?(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(text)
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
    if (d < todayStart) d = new Date(d.getFullYear(), d.getMonth() + 1, day)
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

function normalize(text: string): string {
  return cnTimeToDigits(
    text
      .replace(/今晚/g, '今天晚上')
      .replace(/明晚/g, '明天晚上')
      .replace(/明儿/g, '明天'),
  )
}

/* ---------- 标题抽取 ---------- */

const FILLER =
  /^(?:嗯|那个|就是|然后呢?|帮我把|帮我|麻烦|请|我要|我想|我得|我需要|我打算|我计划|记得|提醒我|到时候提醒我|安排一下|安排|记录一下|记一下|新增|添加|加个|有一个|有个|有|说|可能|大概|差不多|从|那天|到时候|开始)[，,。.\s]*/

function cleanTitle(text: string, removals: string[]): string {
  let t = text
  const all = [...new Set(removals.flatMap((r) => [r, r.trim()]).filter(Boolean))]
  for (const r of all.sort((a, b) => b.length - a.length)) {
    t = t.split(r).join(' ')
  }
  t = t.replace(/到|至|为止|结束/g, ' ')
  let prev = ''
  while (prev !== t) {
    prev = t
    t = t.trim().replace(FILLER, '')
  }
  t = t.replace(/^(?:的|要|得)+/, '').replace(/[，,。.\s]+$/, '').trim()
  t = t.replace(/\s{2,}/g, ' ')
  return t
}

/* ---------- 主入口 ---------- */

export function parseSchedule(inputRaw: string, refDate: Date = new Date()): ParsedDraft | null {
  const text = normalize(inputRaw.trim())
  if (!text) return null

  const matchedTexts: string[] = []
  let startTime = ''
  let endTime = ''

  let rest = text
  const remove = (s: string) => { rest = rest.replace(s, ' ') }

  // 0a) 相对时间：半小时后 / 两小时后
  const rel = extractRelative(rest, refDate)
  let relAt: Date | null = null
  if (rel) {
    relAt = rel.at
    matchedTexts.push(rel.text)
    remove(rel.text)
  }

  // 0b) 重复规则
  const recurHit = extractRecur(rest, refDate)
  let recur: Recur | undefined
  let recurStart: Date | null = null
  if (recurHit) {
    recur = recurHit.recur
    recurStart = recurHit.start
    matchedTexts.push(recurHit.text)
    remove(recurHit.text)
  }

  // 1) 日内时刻
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

  // 2) 持续天数（“出差三天”）
  const duration = extractDuration(rest)
  if (duration) {
    matchedTexts.push(duration.text)
    remove(duration.text)
  }

  // 3) 星期表达式
  const weekday = extractWeekday(rest, refDate)
  let weekdayDate: Date | null = null
  if (weekday) {
    weekdayDate = weekday.date
    matchedTexts.push(weekday.text)
    remove(weekday.text)
  }

  // 4) 同月简写区间：“9月10号到15号”
  let monthRange: { start: Date; end: Date; text: string } | null = null
  {
    const re = /(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]\s*(?:到|至|~|～|—|–|-)\s*(\d{1,2})\s*[号日]/
    const m = re.exec(rest)
    if (m) {
      const month = Number(m[1]) - 1
      let year = refDate.getFullYear()
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

  // 5) 裸「N天后」
  const daysLater = extractDaysLater(rest)
  if (daysLater) {
    matchedTexts.push(daysLater.text)
    remove(daysLater.text)
  }

  // 6) chrono 解析日期
  // 重复规则存在且文本已无显式日期词 → 直接以“下次发生日”为准
  const hasExplicitDate = /明|今|后|昨|月|号|日|周|星期|礼拜|天/.test(rest)
  const results = zh.parse(rest, refDate, { forwardDate: true })
  let startD: Date | null = null
  let endD: Date | null = null

  if (monthRange) {
    startD = monthRange.start
    endD = monthRange.end
  } else if (recur && recurStart && !hasExplicitDate) {
    startD = recurStart
  } else if (results.length > 0) {
    startD = results[0].start.date()
    endD = results[0].end ? results[0].end.date() : null
    matchedTexts.push(results[0].text)
    if (results.length > 1) {
      const between = rest.slice(results[0].index + results[0].text.length, results[1].index)
      if (/^(?:\s*(?:到|至|直到|~|～|—|–|-)\s*)$/.test(between)) {
        endD = results[1].end ? results[1].end.date() : results[1].start.date()
        matchedTexts.push(between, results[1].text)
      }
    }
  } else if (weekdayDate) {
    startD = weekdayDate
  } else if (recurStart) {
    startD = recurStart
  } else if (relAt) {
    startD = relAt
  } else if (daysLater) {
    startD = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + daysLater.days)
  } else {
    // 7) 裸日号：“15号发工资”
    const m = /(?<![月号日点])\s*(\d{1,2})\s*[号日]/.exec(rest)
    if (m) {
      const day = Number(m[1])
      let d = new Date(refDate.getFullYear(), refDate.getMonth(), day)
      const todayStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())
      if (d < todayStart) d = new Date(d.getFullYear(), d.getMonth() + 1, day)
      startD = d
      matchedTexts.push(m[0].trim())
    }
  }

  if (!startD) return null

  // 星期冲突仲裁（如“周五晚上”chrono 误读“晚上”为今天）
  if (weekdayDate && results.length > 0 && !sameDay(startD, weekdayDate)) {
    if (!results[0].start.isCertain('day') || !/[号日月]/.test(results[0].text)) {
      startD = weekdayDate
      if (endD) endD = weekdayDate
    }
  }

  // 时刻区间由自定义规则接管时，chrono 误带的跨日 end 归零
  if (clockRange && endD && !sameDay(startD, endD)) {
    endD = null
  }

  // 相对时间：日期与时刻都由它决定
  if (relAt) {
    startD = relAt
    endD = null
    startTime = `${pad(relAt.getHours())}:${pad(relAt.getMinutes())}`
    endTime = ''
  }

  // 持续天数
  if (!endD && duration && duration.days > 1) {
    endD = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + duration.days - 1)
  }

  // 重复事件归一单日
  if (recur) endD = null

  // 重复事件今天的发生时刻已过 → 从下一次发生日开始
  if (recur && startTime && sameDay(startD, refDate)) {
    const nowHM = `${pad(refDate.getHours())}:${pad(refDate.getMinutes())}`
    if (startTime <= nowHM) {
      const d = new Date(startD)
      for (let i = 1; i <= 370; i++) {
        const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
        const dow = ((cand.getDay() + 6) % 7) + 1
        const by = recur.byDay
        const hit =
          recur.freq === 'daily' ? true
          : recur.freq === 'monthly' ? cand.getDate() === Number(by ?? 1)
          : recur.freq === 'interval' ? i % (Number(by) || 2) === 0
          : Array.isArray(by) ? by.includes(dow)
          : dow === Number(by ?? 1)
        if (hit) {
          startD = cand
          break
        }
      }
    }
  }

  if (endD && endD < startD) [startD, endD] = [endD, startD]

  // chrono 自带确定时刻兜底
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
  recur?: Recur,
): string {
  const s = new Date(sISO + 'T00:00:00')
  const e = new Date(eISO + 'T00:00:00')
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
  const dayPart =
    sISO === eISO ? fmt(s) : `${fmt(s)} — ${fmt(e)} · 共 ${Math.round((e.getTime() - s.getTime()) / 86400000) + 1} 天`
  const timePart = st ? (et ? `${st}–${et}` : `${st}`) : '全天'
  if (!recur) return `${dayPart} · ${timePart}`
  let rl = ''
  if (recur.freq === 'daily') rl = '每天'
  else if (recur.freq === 'monthly') rl = `每月${recur.byDay}号`
  else if (recur.freq === 'interval') rl = `每隔${Number(recur.byDay) - 1}天`
  else if (Array.isArray(recur.byDay)) rl = '每个工作日'
  else rl = `每周${'一二三四五六日'[(recur.byDay as number ?? 1) - 1]}`
  return `${timePart} · 🔁 ${rl}（首次 ${dayPart}）`
}
