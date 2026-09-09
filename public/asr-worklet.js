/**
 * 猫历 ASR AudioWorklet：把麦克风音频（任意采样率）重采样为 16kHz
 * 并以 100ms（1600 采样）一帧推给主进程
 */
class ASRProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buf = new Float32Array(0)
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const src = input[0]
    const ratio = sampleRate / 16000
    const outLen = Math.floor(src.length / ratio)
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio
      const idx = Math.floor(pos)
      const frac = pos - idx
      const a = src[idx] ?? 0
      const b = src[Math.min(idx + 1, src.length - 1)] ?? 0
      out[i] = a + (b - a) * frac
    }
    // 拼缓冲，凑够 1600 采样发一帧
    const merged = new Float32Array(this.buf.length + out.length)
    merged.set(this.buf, 0)
    merged.set(out, this.buf.length)
    let offset = 0
    while (merged.length - offset >= 1600) {
      this.port.postMessage(merged.slice(offset, offset + 1600))
      offset += 1600
    }
    this.buf = merged.slice(offset)
    return true
  }
}

registerProcessor('miaocal-asr', ASRProcessor)
