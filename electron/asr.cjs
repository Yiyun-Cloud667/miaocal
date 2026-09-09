/**
 * 猫历 — 离线语音识别服务（Sherpa-onnx 中文流式模型，主进程本地推理）
 * 模型：sherpa-onnx-streaming-zipformer-zh-14M（int8，约 25MB）
 */
const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let recognizer = null
let stream = null
let modelAvailable = false
let loadError = ''

function modelDir() {
  // 打包后模型在 resources/models，开发时在项目 models/
  const packaged = path.join(process.resourcesPath || '', 'models', 'zh-14M')
  const dev = path.join(__dirname, '../models/zh-14M')
  return fs.existsSync(path.join(packaged, 'tokens.txt')) ? packaged : dev
}

function ensureRecognizer() {
  if (recognizer) return true
  try {
    const sherpa = require('sherpa-onnx-node')
    const M = modelDir()
    if (!fs.existsSync(path.join(M, 'tokens.txt'))) {
      loadError = '模型文件缺失（models/zh-14M）'
      return false
    }
    recognizer = new sherpa.OnlineRecognizer({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: path.join(M, 'encoder-epoch-99-avg-1.int8.onnx'),
          decoder: path.join(M, 'decoder-epoch-99-avg-1.int8.onnx'),
          joiner: path.join(M, 'joiner-epoch-99-avg-1.int8.onnx'),
        },
        tokens: path.join(M, 'tokens.txt'),
        numThreads: 2,
        provider: 'cpu',
        debug: 0,
        enableEndpoint: 1,
        rule1: { minTrailingSilence: 2.0, minUtteranceLength: 0, mustContainNonSilence: false },
      },
    })
    modelAvailable = true
    return true
  } catch (e) {
    loadError = String(e)
    return false
  }
}

function registerASR() {
  ipcMain.handle('asr:status', () => ({
    available: ensureRecognizer(),
    error: loadError,
  }))

  ipcMain.handle('asr:start', (e) => {
    if (!ensureRecognizer()) return { ok: false, error: loadError }
    stream = recognizer.createStream()
    return { ok: true }
  })

  ipcMain.on('asr:feed', (e, samples) => {
    if (!stream || !recognizer) return
    try {
      stream.acceptWaveform({ sampleRate: 16000, samples: Float32Array.from(samples) })
      while (recognizer.isReady(stream)) recognizer.decode(stream)
      // 部分结果（边说边显示）
      const partial = recognizer.getResult(stream).text
      if (partial) e.sender.send('asr:partial', partial)
      // 停顿超 2 秒自动成句
      if (recognizer.isEndpoint(stream)) {
        const text = recognizer.getResult(stream).text
        if (text) e.sender.send('asr:segment', text)
        recognizer.reset(stream)
      }
    } catch { /* 忽略单帧错误 */ }
  })

  ipcMain.handle('asr:stop', (e) => {
    if (!stream || !recognizer) return { text: '' }
    try {
      // 尾部补 1 秒静音，保证结尾词不丢
      stream.acceptWaveform({ sampleRate: 16000, samples: new Float32Array(16000) })
      while (recognizer.isReady(stream)) recognizer.decode(stream)
      stream.inputFinished()
      while (recognizer.isReady(stream)) recognizer.decode(stream)
      const text = recognizer.getResult(stream).text
      stream = null
      return { text }
    } catch (err) {
      stream = null
      return { text: '', error: String(err) }
    }
  })
}

module.exports = { registerASR }
