/** 重复规则 */
export interface Recur {
  freq: 'daily' | 'weekly' | 'monthly' | 'interval'
  /** weekly: 1-7（周一=1）或工作日数组 [1..5]；monthly: 1-31；interval: 每 N 天 */
  byDay?: number | number[]
}

/** 日程事件数据模型 */
export interface CalEvent {
  id: string
  title: string
  /** ISO 日期 YYYY-MM-DD（开始日，含） */
  startDate: string
  /** ISO 日期 YYYY-MM-DD（结束日，含） */
  endDate: string
  /** "HH:mm"，空串表示全天 */
  startTime: string
  endTime: string
  /** 调色板 key，见 COLORS */
  color: string
  /** 完成打卡 */
  done: boolean
  /** 重复规则（重复事件为单日） */
  recur?: Recur
  /** 来源：语音 / 手动 */
  source: 'voice' | 'manual'
  /** 原始自然语言输入（语音/文本） */
  rawText?: string
  createdAt: number
}

/** 解析结果（预览确认用） */
export interface ParsedDraft {
  title: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  color: string
  recur?: Recur
  rawText: string
  /** 解析出的时间段描述，用于 UI 展示 */
  summary: string
}
