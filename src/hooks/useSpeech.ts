import { useCallback, useEffect, useRef, useState } from 'react'

/** Web Speech API 语音识别（中文）封装 */
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

export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [supported, setSupported] = useState(true)
  const recRef = useRef<SR | null>(null)

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
    rec.continuous = false
    rec.onresult = (e: any) => {
      let final = ''
      let inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else inter += r[0].transcript
      }
      setInterim(inter)
      if (final) {
        setInterim('')
        onFinal(final.trim())
      }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    return () => {
      try { rec.abort() } catch { /* noop */ }
    }
  }, [onFinal])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      setInterim('')
      try {
        rec.start()
        setListening(true)
      } catch {
        /* 已启动时重复调用会抛错，忽略 */
      }
    }
  }, [listening])

  return { listening, interim, supported, toggle }
}
