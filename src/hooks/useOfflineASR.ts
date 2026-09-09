import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 离线语音识别 hook（Electron + Sherpa-onnx 本地中文模型，不依赖外网）
 * 仅在 window.miaoASR 存在（桌面应用）时可用
 */
declare global {
  interface Window {
    miaoASR?: {
      status: () => Promise<{ available: boolean; error?: string }>
      start: () => Promise<{ ok: boolean; error?: string }>
      feed: (samples: Float32Array) => void
      stop: () => Promise<{ text: string; error?: string }>
      onPartial: (cb: (t: string) => void) => () => void
      onSegment: (cb: (t: string) => void) => () => void
    }
  }
}

export function useOfflineASR(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const mediaRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const unsubsRef = useRef<Array<() => void>>([])

  // 检测桌面端离线能力
  useEffect(() => {
    if (!window.miaoASR) return
    window.miaoASR.status().then((s) => setSupported(s.available)).catch(() => setSupported(false))
  }, [])

  useEffect(() => {
    const asr = window.miaoASR
    if (!asr) return
    unsubsRef.current.push(asr.onPartial((t) => setInterim(t)))
    unsubsRef.current.push(
      asr.onSegment((t) => {
        setInterim('')
        const text = t.trim()
        if (text) onFinal(text)
      }),
    )
    return () => unsubsRef.current.forEach((u) => u())
  }, [onFinal])

  const stopCapture = () => {
    try { nodeRef.current?.disconnect() } catch { /* noop */ }
    try { ctxRef.current?.close() } catch { /* noop */ }
    mediaRef.current?.getTracks().forEach((t) => t.stop())
    nodeRef.current = null
    ctxRef.current = null
    mediaRef.current = null
  }

  const toggle = useCallback(async () => {
    const asr = window.miaoASR
    if (!asr) return
    setError('')
    if (listening) {
      setListening(false)
      setInterim('')
      stopCapture()
      const { text } = await asr.stop()
      const t = (text ?? '').trim()
      if (t) onFinal(t)
      return
    }
    const r = await asr.start()
    if (!r.ok) {
      setError('离线识别启动失败：' + (r.error ?? '未知错误'))
      return
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      const ctx = new AudioContext()
      await ctx.audioWorklet.addModule('./asr-worklet.js')
      const src = ctx.createMediaStreamSource(media)
      const node = new AudioWorkletNode(ctx, 'miaocal-asr')
      node.port.onmessage = (e) => asr.feed(e.data)
      // 经零增益节点接入 destination：保持处理运转但不外放
      const mute = ctx.createGain()
      mute.gain.value = 0
      src.connect(node)
      node.connect(mute)
      mute.connect(ctx.destination)
      mediaRef.current = media
      ctxRef.current = ctx
      nodeRef.current = node
      setListening(true)
    } catch (err) {
      await asr.stop()
      setError('无法访问麦克风：请在系统设置中允许后重试')
    }
  }, [listening, onFinal])

  return { supported, listening, interim, error, toggle }
}
