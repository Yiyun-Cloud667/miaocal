import { useCallback, useEffect, useRef, useState } from 'react'

/** Web Speech API 语音识别（中文）封装：连续识别 + 错误透传 */
interface SR extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': '麦克风权限被拒绝：请在浏览器/系统设置里允许麦克风后重试',
  'service-not-allowed': '语音识别服务不可用，请改用打字输入',
  'network': '语音识别服务连接失败（需要能访问识别服务的网络），可先打字输入',
  'audio-capture': '没有找到可用的麦克风设备',
  'no-speech': '没有听到声音，靠近麦克风再试一次',
}

export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [supported, setSupported] = useState(true)
  const recRef = useRef<SR | null>(null)
  const stoppingRef = useRef(false)
  const activityRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) {
      setSupported(false)
      return
    }
    const rec: SR = new Ctor()
    rec.lang = 'zh-CN'
    rec.interimResults = true
    rec.continuous = true // 连续识别：说完一整段再手动结束
    rec.onresult = (e: any) => {
      activityRef.current = true
      let inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          setInterim('')
          const t = r[0].transcript.trim()
          if (t) onFinal(t)
        } else {
          inter += r[0].transcript
        }
      }
      if (inter) setInterim(inter)
    }
    rec.onerror = (e: any) => {
      const code = e?.error ?? ''
      setError(ERROR_TEXT[code] ?? `识别出错（${code || '未知'}），请改用打字输入`)
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      stoppingRef.current = false
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    }
    recRef.current = rec
    return () => {
      try { rec.abort() } catch { /* noop */ }
    }
  }, [onFinal])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    setError('')
    if (listening) {
      // 立即反馈“已结束”；stop() 等待残余结果，2 秒后仍未结束则强制 abort
      stoppingRef.current = true
      setListening(false)
      setInterim('')
      try { rec.stop() } catch { /* noop */ }
      setTimeout(() => {
        if (stoppingRef.current) {
          try { rec.abort() } catch { /* noop */ }
        }
      }, 2000)
    } else {
      if (stoppingRef.current) return // 上一次正在收尾，忽略连点
      setInterim('')
      try {
        activityRef.current = false
        rec.start()
        setListening(true)
        // 看门狗：10 秒无任何识别活动（网络挂起时给用户提示而不是干等）
        if (watchdogRef.current) clearTimeout(watchdogRef.current)
        watchdogRef.current = setTimeout(() => {
          if (!activityRef.current) {
            setError('识别服务暂无响应（需要联网到识别服务），可先打字输入，或检查网络后重试')
          }
        }, 10_000)
      } catch {
        /* 已启动时重复调用会抛错，忽略 */
      }
    }
  }, [listening])

  return { listening, interim, error, supported, toggle }
}
