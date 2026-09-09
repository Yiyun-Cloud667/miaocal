/** preload：把离线 ASR 能力安全暴露给渲染进程 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('miaoASR', {
  status: () => ipcRenderer.invoke('asr:status'),
  start: () => ipcRenderer.invoke('asr:start'),
  feed: (samples) => ipcRenderer.send('asr:feed', samples),
  stop: () => ipcRenderer.invoke('asr:stop'),
  onPartial: (cb) => {
    const h = (_, t) => cb(t)
    ipcRenderer.on('asr:partial', h)
    return () => ipcRenderer.removeListener('asr:partial', h)
  },
  onSegment: (cb) => {
    const h = (_, t) => cb(t)
    ipcRenderer.on('asr:segment', h)
    return () => ipcRenderer.removeListener('asr:segment', h)
  },
})
