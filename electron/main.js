//main.js
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, globalShortcut } = require('electron')
const path = require('path')

if (process.platform === 'win32') {
    app.setAppUserModelId('com.targame.app')
}
const { execFileSync } = require('child_process')
const { setupIpcHandlers, performAppCleanup, isCleanupDone, getTincInstance } = require('./ipc')
const { NetbirdCLI } = require('./netbird')
const { AppUpdater, applyPendingUpdates } = require('./updater')
const Store = require('./store')
const overlayNative = require('./overlay-native')
const {
    ensureCrashWatchdogScheduledTask,
    startCrashMarkerHeartbeat,
} = require('./crash-watchdog')
const store = new Store()

// Apply any staged updates before anything else starts
applyPendingUpdates()

const updater = new AppUpdater()

function initUpdater() {
    if (isDev) return

    updater.on('progress', ({ percent }) => {
        mainWindow?.webContents.send('update:progress', { percent })
    })
    updater.on('ready', () => {
        mainWindow?.webContents.send('update:downloaded', {})
    })
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let crashHeartbeatTimer = null

// ── چک دسترسی Administrator ─────────────────────────────────────────────
// اپ به admin نیاز داره (نصب درایور، سرویس، netsh). اگه admin نیست،
// خودش رو با دسترسی admin دوباره اجرا می‌کنه (یک UAC در ابتدا).
function isAdmin() {
    try {
        // این دستور فقط با admin موفق می‌شه
        execFileSync('net', ['session'], { stdio: 'ignore', windowsHide: true })
        return true
    } catch {
        return false
    }
}

function relaunchAsAdmin() {
    try {
        const exe = process.execPath
        let psCmd
        if (app.isPackaged) {
            // نسخه نصب‌شده: خود exe رو elevated اجرا کن
            psCmd = `Start-Process -FilePath '${exe}' -Verb RunAs`
        } else {
            // dev mode: electron + مسیر پروژه
            const appPath = path.resolve(__dirname, '..')
            psCmd = `Start-Process -FilePath '${exe}' -ArgumentList '${appPath}' -Verb RunAs`
        }
        require('child_process').spawnSync('powershell.exe',
            ['-NoProfile', '-Command', psCmd], { windowsHide: true })
    } catch (e) {
        // اگه کاربر UAC رو رد کنه، اینجا میاد
    }
}

// اگه روی ویندوزیم و admin نیستیم, relaunch با admin
if (process.platform === 'win32' && !isAdmin()) {
    relaunchAsAdmin()
    app.quit()
    // جلوگیری از ادامه اجرای نسخه non-admin
    process.exit(0)
}

let mainWindow = null
let overlayWin = null
let tray = null
let overlayShortcut = null   // شورت‌کاتِ فعلیِ ثبت‌شده
let voiceShortcut = null     // شورت‌کات قطع/وصل میک
let tincResetShortcut = null
let overlayPanelVisible = false

// ── Single Instance Lock ───────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
    // اگه نسخه دیگه‌ای در حال اجراست، همین رو ببند
    app.quit()
} else {
    // وقتی کاربر دوباره اپ رو باز می‌کنه، پنجره قبلی رو بیار جلو
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
        }
    })
}

// ──────────────────────────── ICON ───────────────────────────────────

function getIcon() {
    const isWin = process.platform === 'win32'
    const candidates = isWin
        ? [
            path.join(__dirname, '../assets/icon-256.ico'),
            path.join(__dirname, '../assets/icon.ico'),
            path.join(process.resourcesPath || '', 'assets/icon-256.ico'),
            path.join(process.resourcesPath || '', 'assets/icon.ico'),
            path.join(__dirname, '../assets/icon-256.png'),
          ]
        : [
            path.join(__dirname, '../assets/icon-256.png'),
            path.join(process.resourcesPath || '', 'assets/icon-256.png'),
          ]
    for (const p of candidates) {
        try {
            const img = nativeImage.createFromPath(p)
            if (!img.isEmpty()) return img
        } catch {}
    }
    return nativeImage.createEmpty()
}

function getTrayIcon() {
    const icon = getIcon()
    if (icon.isEmpty()) return icon
    return icon.resize({ width: 16, height: 16 })
}

// ──────────────────────────── WINDOW ─────────────────────────────────

function createWindow() {
    const icon = getIcon()

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: !isDev,
            // The app is backgrounded the whole time the user is in a fullscreen
            // game (alt+tab). Without this, Electron throttles timers and the
            // SignalR socket drops & reconnects, which used to cascade into tinc
            // restarts and voice hiccups. Keep it running at full speed.
            backgroundThrottling: false
        },
        icon,
        show: false
    })

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/web/index.html'))
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // close event فقط برای quit واقعی
    mainWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault()
            mainWindow.hide()
        }
    })
}

// ──────────────── OVERLAY WINDOW (پنجره شفاف روی بازی) ──────────────
// شورت‌کات Ctrl+~ یک پنجره جداگانه و شفاف رو روی بازی نشون می‌ده.
// این پنجره state لابی رو از پنجره اصلی از طریق IPC می‌گیره.

const DEFAULT_SHORTCUTS = {
    toggleOverlay:    'Control+`',
    voiceMuteToggle:  'Control+U',
    tincReset:        'Control+1',
}

function getShortcut(name) {
    return store.get(`settings.shortcuts.${name}`) || DEFAULT_SHORTCUTS[name]
}

function createOverlayWindow() {
    const { screen } = require('electron')
    const { width, height, x: sx, y: sy } = screen.getPrimaryDisplay().workArea

    overlayWin = new BrowserWindow({
        width,
        height,
        x: sx,
        y: sy,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'overlay-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: !isDev,
        },
        show: false,
    })

    if (isDev) {
        overlayWin.loadURL('http://localhost:5173')
    } else {
        overlayWin.loadFile(path.join(__dirname, '../build/web/index.html'))
    }

    overlayWin.on('closed', () => {
        overlayWin = null
        overlayPanelVisible = false
    })
}

function showOverlayPanel() {
    if (!overlayWin) createOverlayWindow()
    overlayPanelVisible = true
    overlayWin.setIgnoreMouseEvents(false)
    // Bring the overlay to the foreground WITH focus. For a game this pulls it
    // out of fullscreen/focus (the alt-tab effect) so the overlay is actually
    // visible — even on exclusive-fullscreen games where a desktop window can't
    // composite on top. showInactive() didn't take focus, so over a focused
    // game nothing appeared at all.
    overlayWin.show()
    overlayWin.focus()
    overlayWin.webContents.send('overlay:visibility', true)
}

function hideOverlayPanel() {
    if (!overlayWin) return
    overlayPanelVisible = false
    overlayWin.webContents.send('overlay:visibility', false)
    // Actually hide the window so it doesn't interfere with game focus at all
    overlayWin.hide()
}

let _lastOverlayToggle = 0
function toggleOverlayPanel() {
    // When a game is running, toggle is handled by the native DLL via pipe
    if (overlayNative.isActive()) {
        overlayNative.toggle()
        return
    }
    // Debounce: rapidly toggling a transparent always-on-top fullscreen window
    // over a game thrashes the Windows compositor and can hang. Ignore repeats
    // that arrive within 350ms of the last toggle.
    const now = Date.now()
    if (now - _lastOverlayToggle < 350) return
    _lastOverlayToggle = now

    if (overlayPanelVisible) {
        hideOverlayPanel()
    } else {
        showOverlayPanel()
    }
}

function attachOverlayToGame(windowTitle) {
    if (!overlayWin) createOverlayWindow()
    try {
        const { OverlayWindow } = require('electron-overlay-window')
        OverlayWindow.attachTo(overlayWin, windowTitle)
        console.log('[overlay] attached to game window:', windowTitle)
    } catch {
        // electron-overlay-window not available — manual fullscreen positioning is used
        console.log('[overlay] manual mode (electron-overlay-window not available)')
    }
}

function registerOverlayShortcut() {
    if (overlayShortcut) {
        try { globalShortcut.unregister(overlayShortcut) } catch {}
        overlayShortcut = null
    }
    const accel = getShortcut('toggleOverlay')
    try {
        const ok = globalShortcut.register(accel, toggleOverlayPanel)
        if (ok) overlayShortcut = accel
        else console.log('[shortcut] register returned false for', accel)
    } catch (e) {
        console.log('[shortcut] register failed:', e.message)
    }
}

function registerVoiceShortcut() {
    if (voiceShortcut) {
        try { globalShortcut.unregister(voiceShortcut) } catch {}
        voiceShortcut = null
    }
    const accel = getShortcut('voiceMuteToggle')
    try {
        const ok = globalShortcut.register(accel, () => {
            // Only dispatch when our windows don't have focus (i.e. user is in-game).
            // When main window has focus the DOM keydown handler in VoiceControls fires,
            // but globalShortcut consumes the key first — so always forward via IPC.
            mainWindow?.webContents.send('voice:global-toggle-mic')
        })
        if (ok) voiceShortcut = accel
        else console.log('[shortcut] voice register returned false for', accel)
    } catch (e) {
        console.log('[shortcut] voice register failed:', e.message)
    }
}

function registerTincResetShortcut() {
    if (tincResetShortcut) {
        try { globalShortcut.unregister(tincResetShortcut) } catch {}
        tincResetShortcut = null
    }
    const accel = getShortcut('tincReset')
    try {
        const ok = globalShortcut.register(accel, async () => {
            try {
                mainWindow?.webContents.send('tinc:hard-reset-start')
                const tinc = getTincInstance()
                const result = await tinc.hardReset()
                mainWindow?.webContents.send('tinc:hard-reset-done', result)
            } catch (e) {
                mainWindow?.webContents.send('tinc:hard-reset-done', {
                    success: false, error: e.message, running: false, restarted: false,
                })
            }
        })
        if (ok) tincResetShortcut = accel
        else console.log('[shortcut] tinc reset register returned false for', accel)
    } catch (e) {
        console.log('[shortcut] tinc reset register failed:', e.message)
    }
}

// ──────────────────────────── TRAY ───────────────────────────────────

function createTray() {
    const icon = getTrayIcon()
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'نمایش TarGame',
            click: () => {
                mainWindow?.show()
                mainWindow?.focus()
            }
        },
        { type: 'separator' },
        {
            label: 'خروج',
            click: async () => {
                const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
                    type: 'question',
                    buttons: ['خروج', 'انصراف'],
                    defaultId: 1,
                    title: 'TarGame',
                    message: 'آیا می‌خواهید از TarGame خارج شوید؟',
                    noLink: true
                })
                if (response === 0) {
                    app.isQuitting = true
                    // Tell the renderer to show the quitting spinner before cleanup starts
                    mainWindow?.webContents.send('window:quitting')
                    await new Promise(r => setTimeout(r, 120))
                    performAppCleanup().then(() => app.exit(0))
                }
            }
        }
    ])

    tray.setToolTip('TarGame')
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => {
        mainWindow?.show()
        mainWindow?.focus()
    })
}

// ──────────────────────────── APP LIFECYCLE ──────────────────────────

app.whenReady().then(async () => {
    createWindow()
    createTray()
    createOverlayWindow()
    initUpdater()

    // Start the native overlay pipe server; forward DLL actions to renderer
    overlayNative.setup(mainWindow)
    mainWindow?.webContents.on('did-finish-load', () => {
        // Re-wire after renderer reloads (dev hot-reload)
        overlayNative.setup(mainWindow)
    })

    setupIpcHandlers(ipcMain, mainWindow, {
        onGameLaunched: (windowTitle) => {
            // Wait for the game to open its window before attaching
            setTimeout(() => attachOverlayToGame(windowTitle), 4000)
        }
    })
    registerOverlayShortcut()
    registerVoiceShortcut()
    registerTincResetShortcut()

    // Watchdog (best-effort): Scheduled Task هر ۱ دقیقه چک می‌کنه که اپ باز باشه؛
    // اگه بسته شد (کرش یا بستن عادی) و ~۱ دقیقه گذشت، سرویس نت‌برد/tinc رو کامل جمع می‌کنه.
    // Task args are fixed to pass path-to-app, so the Electron usage popup shouldn't happen.
    try {
        ensureCrashWatchdogScheduledTask({
            exePath: process.execPath,
            appPath: app.getAppPath(),
        })
        crashHeartbeatTimer = startCrashMarkerHeartbeat({ intervalMs: 10000 })
    } catch {}

    // IPC: تنظیم/خواندن شورت‌کات
    ipcMain.handle('shortcut:set', (_, name, accelerator) => {
        store.set(`settings.shortcuts.${name}`, accelerator)
        registerOverlayShortcut()
        registerVoiceShortcut()
        registerTincResetShortcut()
        return true
    })
    ipcMain.handle('shortcut:get', (_, name) => getShortcut(name))

    // ── Overlay IPC ────────────────────────────────────────────────────

    // Overlay window closes itself (X button or Esc)
    ipcMain.on('overlay:close', () => hideOverlayPanel())

    // State sync: main window → Electron overlay window + native DLL overlay
    ipcMain.on('overlay:state-update', (_, state) => {
        overlayWin?.webContents.send('overlay:state', state)
        if (state) {
            const useNetbirdIp = state.selectedGameType === 2
            overlayNative.pushState({
                selfId:  state.user?.id?.toString() ?? '',
                members: (state.members ?? []).map(m => ({
                    id:    m.userId?.toString() ?? '',
                    name:  m.username ?? m.name ?? '',
                    ip:    useNetbirdIp ? (m.ip ?? '') : (m.tincIp ?? m.ip ?? ''),
                    muted: false,
                })),
                friends: [],
            })
        }
    })

    // Message sent from overlay window → forward to main window
    ipcMain.on('overlay:send-message', (_, text) => {
        mainWindow?.webContents.send('overlay:incoming-message', text)
    })

    // Voice action from overlay → forward to main window
    ipcMain.on('overlay:voice-action', (_, data) => {
        mainWindow?.webContents.send('overlay:incoming-voice-action', data)
    })

    // Renderer manually attaches overlay to a game window title
    ipcMain.on('overlay:attach', (_, windowTitle) => {
        attachOverlayToGame(windowTitle)
    })

    // Renderer: get actual app version from package.json inside the running asar
    ipcMain.on('app:version-sync', (e) => { e.returnValue = app.getVersion() })

    // Renderer: start downloading app.asar
    ipcMain.on('update:download', (_) => {
        updater.downloadAndStage().catch(err => {
            console.error('[updater] download failed:', err.message)
            mainWindow?.webContents.send('update:error', { message: err.message })
        })
    })

    // Renderer: relaunch to apply staged update
    ipcMain.on('update:install', () => {
        updater.relaunch()
    })

    // SignalR push from renderer: server notified a new version is available
    ipcMain.on('update:server-push', (_, updates) => {
        mainWindow?.webContents.send('update:available', { updates, silent: true })
    })

    const netbird = new NetbirdCLI()
    const installed = await netbird.isInstalled()
    if (!installed) {
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('netbird:install-required')
        })
    }
})

app.on('window-all-closed', () => {
    // هیچ کاری نکن — tray هندل می‌کنه
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else {
        mainWindow?.show()
        mainWindow?.focus()
    }
})

app.on('will-quit', () => {
    try { globalShortcut.unregisterAll() } catch {}
    overlayNative.destroy()
})

app.on('before-quit', (e) => {
    if (isCleanupDone()) return
    try { if (crashHeartbeatTimer) clearInterval(crashHeartbeatTimer) } catch {}
    app.isQuitting = true
    e.preventDefault()
    // به renderer خبر بده تا موازی با cleanup شبکه (که چند ثانیه طول می‌کشه)
    // درخواست لاگ‌اوت سمت سرور رو هم بفرسته — این مسیر (OS shutdown/Alt+F4)
    // قبلاً هیچ سیگنالی به renderer نمی‌فرستاد.
    mainWindow?.webContents.send('window:quitting')
    performAppCleanup().then(() => app.exit(0))
})