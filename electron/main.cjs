/**
 * 猫历 MiaoCal — Electron 主进程
 * 两种窗口：
 *  1) 主窗口：完整日历应用
 *  2) 桌面小组件：无边框、透明、置顶、可拖动的迷你窗（日历打点 / 今日待办）
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require('electron')
const path = require('path')
const { registerASR } = require('./asr.cjs')

const PRELOAD = path.join(__dirname, 'preload.cjs')

let mainWin = null
let widgetWin = null
let tray = null

const isDev = !!process.env.VITE_DEV_SERVER_URL

function loadURL(win, hash) {
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL + '#' + hash)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash })
  }
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: '猫历 MiaoCal',
    backgroundColor: '#f5f4f1',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: { contextIsolation: true, preload: PRELOAD },
  })
  loadURL(mainWin, '/')
  mainWin.on('closed', () => (mainWin = null))
}

function createWidget() {
  if (widgetWin) {
    widgetWin.show()
    widgetWin.focus()
    return
  }
  widgetWin = new BrowserWindow({
    width: 320,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: '猫历小组件',
    webPreferences: { contextIsolation: true, preload: PRELOAD },
  })
  // 点击穿透关闭（保持可拖动）；拖动区域由 CSS -webkit-app-region 控制
  loadURL(widgetWin, '/widget')
  widgetWin.on('closed', () => (widgetWin = null))
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, '../build/icon.png')).resize({ width: 18, height: 18 })
  tray = new Tray(img)
  tray.setToolTip('猫历 MiaoCal')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开猫历', click: () => (mainWin ? (mainWin.show(), mainWin.focus()) : createMainWindow()) },
      { label: '桌面小组件', click: createWidget },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  )
}

app.whenReady().then(() => {
  // Dock 图标（开发模式也显示品牌图标；打包后由 electron-builder 处理）
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, '../build/icon.png')))
  }
  registerASR()
  // --widget：仅启动桌面小组件；默认启动主窗口
  if (process.argv.includes('--widget')) {
    createWidget()
  } else {
    createMainWindow()
  }
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 外链走系统浏览器
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
