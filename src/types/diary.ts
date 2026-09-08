/** 日记条目（按日期一天一篇） */
export interface DiaryEntry {
  /** YYYY-MM-DD */
  date: string
  /** 心情 key：great/good/ok/low/bad，空串未选 */
  mood: string
  text: string
  updatedAt: number
}

export const MOODS: Array<{ key: string; emoji: string; label: string; color: string }> = [
  { key: 'great', emoji: '😄', label: '很开心', color: '#FF8A00' },
  { key: 'good',  emoji: '🙂', label: '不错',   color: '#2563EB' },
  { key: 'ok',    emoji: '😐', label: '一般',   color: '#8A93A6' },
  { key: 'low',   emoji: '😔', label: '有点丧', color: '#7C3AED' },
  { key: 'bad',   emoji: '😣', label: '很糟',   color: '#FF5C7A' },
]

export function moodOf(key: string) {
  return MOODS.find((m) => m.key === key)
}
