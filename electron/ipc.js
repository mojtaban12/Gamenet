const { NetbirdCLI } = require('./netbird')
const { TincCLI } = require('./tinc')
const { GameManager } = require('./games')
const { ObsManager } = require('./obs')
const Store = require('./store')
const path = require('path')
const overlayNative = require('./overlay-native')

function getIconPath() {
    const candidates = [
        path.join(__dirname, '../assets/icon-256.png'),
        path.join(__dirname, '../assets/icon.ico'),
    ]
    const fs = require('fs')
    for (const p of candidates) if (fs.existsSync(p)) return p
    return undefined
}

const netbird = new NetbirdCLI()
const tinc = new TincCLI()
const gameManager = new GameManager()
const obs = new ObsManager()
const store   = new Store()

let cleanupDone = false
let cleanupPromise = null
let activeGame = null // { exeName, gameName } — persists across renderer re-mounts

async function performAppCleanup() {
    if (cleanupDone) return
    if (cleanupPromise) return cleanupPromise   // re-entrant guard: await the same run
    cleanupPromise = (async () => {
        // NetBird `down` FIRST and time-bounded. This is what removes the wt0
        // tunnel and restores the user's DNS/routes — the actual harm if it gets
        // skipped. The Windows service is intentionally left INSTALLED for a fast
        // reconnect next launch; a FULL uninstall happens only on explicit logout,
        // never on app close. (The old code uninstalled on every exit inside a 6s
        // race, then hard-killed with app.exit(0) — so a slow uninstall got cut
        // off, leaving wt0/DNS/service behind. That was the bug.)
        try { await netbird.disconnect(8000) } catch {}
        // Stop the tinc overlay too, bounded so a hung step can't block quit.
        await Promise.race([
            (async () => { try { await tinc.stop().catch(() => {}) } catch {} })(),
            new Promise(r => setTimeout(r, 5000))
        ])
        cleanupDone = true
    })()
    return cleanupPromise
}

function setupIpcHandlers(ipcMain, mainWindow, callbacks = {}) {

    const send = (channel, data) => mainWindow?.webContents.send(channel, data)

    // Event-driven game-exit detection (see games.js `launch()` — the child
    // process's own 'exit' event, not tasklist polling). When the currently
    // tracked active game's process actually terminates, clear activeGame and
    // tell the renderer immediately. Registered once here since setupIpcHandlers
    // runs a single time at app startup.
    gameManager.on('game-exit', ({ exeName }) => {
        if (activeGame && activeGame.exeName === exeName) {
            activeGame = null
            send('games:exited', { exeName })
        }
    })

    // ─────────────── WINDOW CONTROLS ─────────────────────────────────

    ipcMain.on('window:minimize', () => mainWindow?.minimize())
    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize()
        else mainWindow?.maximize()
    })
    // X زده شد → modal نشون بده
    ipcMain.on('window:close', () => {
        mainWindow?.webContents.send('window:close-request')
    })

    // خروج کامل — پاکسازی شبکه، بعد بستن اپ
    ipcMain.handle('window:quit', async () => {
        const { app } = require('electron')
        app.isQuitting = true
        await performAppCleanup()
        app.exit(0)
    })

    // minimize به tray
    ipcMain.on('window:minimize-tray', () => {
        mainWindow?.hide()
    })

    // ─────────────── NATIVE NOTIFICATION ─────────────────────────────
    // فقط وقتی پنجره focus نداره (minimize/background) نوتیف سیستمی بده

    ipcMain.handle('notify:native', (_, { title, body }) => {
        const { Notification } = require('electron')
        if (!Notification.isSupported()) return false

        const notif = new Notification({
            title: title || 'TarGame',
            body: body || '',
            icon: getIconPath(),
            silent: false
        })

        notif.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore()
                mainWindow.show()
                mainWindow.focus()
                mainWindow.webContents.send('notif:clicked')
            }
        })

        notif.show()
        return true
    })

    // وضعیت focus پنجره — minimize یا بدون focus یعنی پنهان
    ipcMain.handle('window:is-focused', () => {
        if (!mainWindow) return false
        if (mainWindow.isMinimized()) return false
        if (!mainWindow.isVisible()) return false
        return mainWindow.isFocused()
    })

    // ─────────────── AUTH ────────────────────────────────────────────

    ipcMain.handle('auth:save', (_, { token, user }) => {
        store.set('auth.token', token)
        store.set('auth.user', user)
        return true
    })

    ipcMain.handle('auth:load', () => ({
        token: store.get('auth.token'),
        user:  store.get('auth.user')
    }))

    ipcMain.handle('auth:clear', () => {
        store.delete('auth.token')
        store.delete('auth.user')
        return true
    })

    ipcMain.handle('auth:save-credentials', (_, { email, password, remember }) => {
        if (!remember) {
            store.delete('auth.savedEmail')
            store.delete('auth.savedPassword')
            store.delete('auth.passwordEncrypted')
            store.set('auth.rememberCredentials', false)
            return true
        }

        const { safeStorage } = require('electron')
        store.set('auth.rememberCredentials', true)
        store.set('auth.savedEmail', email)

        if (safeStorage.isEncryptionAvailable()) {
            store.set('auth.savedPassword', safeStorage.encryptString(password).toString('base64'))
            store.set('auth.passwordEncrypted', true)
        } else {
            store.set('auth.savedPassword', password)
            store.set('auth.passwordEncrypted', false)
        }
        return true
    })

    ipcMain.handle('auth:load-credentials', () => {
        if (!store.get('auth.rememberCredentials')) return null

        const email = store.get('auth.savedEmail')
        const passwordData = store.get('auth.savedPassword')
        if (!email || passwordData == null) return null

        const { safeStorage } = require('electron')
        let password
        if (store.get('auth.passwordEncrypted') && safeStorage.isEncryptionAvailable()) {
            password = safeStorage.decryptString(Buffer.from(passwordData, 'base64'))
        } else {
            password = passwordData
        }
        return { email, password, remember: true }
    })

    ipcMain.handle('auth:clear-credentials', () => {
        store.delete('auth.savedEmail')
        store.delete('auth.savedPassword')
        store.delete('auth.passwordEncrypted')
        store.set('auth.rememberCredentials', false)
        return true
    })

    // ─────────────── NETBIRD ─────────────────────────────────────────

    ipcMain.handle('netbird:is-installed', async () => {
        return await netbird.isInstalled()
    })

    ipcMain.handle('netbird:install', async () => {
        try {
            send('netbird:install-progress', { step: 'copying', msg: 'در حال کپی فایل‌ها...' })
            await netbird.install()
            // tinc و آداپتر شبکه رو همینجا نصب و آماده کن (یکبار برای همیشه)
            send('netbird:install-progress', { step: 'network', msg: 'در حال نصب درایور شبکه...' })
            await tinc.install().catch(e => console.log('[tinc install]', e.message))
            send('netbird:install-progress', { step: 'done', msg: 'نصب کامل شد' })
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('netbird:connect', async (_, { managementUrl, setupKey, hostname }) => {
        try {
            await netbird.connect(managementUrl, setupKey, hostname)
            await new Promise(r => setTimeout(r, 3000))
            const status = await netbird.waitForConnection(20000)
            if (!status.connected) return { success: false, error: 'اتصال برقرار نشد' }
            // پس از اتصال موفق، watchdog رو روشن کن تا بعد از قطعی/تغییر اینترنت
            // خودکار و با همون IP دوباره وصل بشه.
            netbird.startWatchdog(s => send('netbird:status', s))
            return { success: true, ...status }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // reconnect دستی (دکمه‌ی «اتصال مجدد») — همون IP حفظ می‌شه
    ipcMain.handle('netbird:reconnect', async () => {
        try {
            const status = await netbird.reconnect()
            netbird.startWatchdog(s => send('netbird:status', s))
            return { success: true, ...status }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // renderer پس از پایان موفق setup این رو صدا می‌زنه تا حتی وقتی از قبل
    // متصل بودیم (بدون فراخوانی connect) هم watchdog روشن بشه.
    ipcMain.handle('netbird:watch', async () => {
        netbird.startWatchdog(s => send('netbird:status', s))
        return { success: true }
    })

    ipcMain.handle('netbird:disconnect', async () => ({
        success: await netbird.disconnect()
    }))

    ipcMain.handle('netbird:uninstall', async () => {
        try { await netbird.stopAndUninstall() } catch {}
        return { success: true }
    })

    ipcMain.handle('netbird:status', async () => {
        return await netbird.getStatus()
    })

    // ─────────────── TINC (L2 mesh) ──────────────────────────────────

    ipcMain.handle('tinc:is-installed', async () => {
        return await tinc.isInstalled()
    })

    ipcMain.handle('tinc:install', async () => {
        try {
            await tinc.install()
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // اعمال config و start/restart سرویس
    ipcMain.handle('tinc:apply-config', async (_, zipBase64) => {
        try {
            const buf = Buffer.from(zipBase64, 'base64')
            await tinc.restart(buf)  // applyConfig + start (یک UAC)
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // به‌روزرسانی زنده‌ی peerها بدون restart/قطع تونل (join/leave وسط بازی)
    ipcMain.handle('tinc:update-config', async (_, zipBase64) => {
        try {
            const buf = Buffer.from(zipBase64, 'base64')
            return await tinc.updateHostsLive(buf)
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('tinc:stop', async () => {
        try {
            await tinc.stop()
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('tinc:status', async () => {
        return await tinc.getStatus()
    })

    // ─────────────── GAMES ───────────────────────────────────────────
    // gameInfo از سرور میاد: { name, exeName, registryKey, registryValue }

    ipcMain.handle('games:is-installed', async (_, gameInfo) => {
        return await gameManager.isInstalled(gameInfo)
    })

    ipcMain.handle('games:is-running', async (_, gameInfo) => {
        return await gameManager.isRunning(gameInfo)
    })

    ipcMain.handle('games:get-icon', async (_, gameInfo) => {
        return await gameManager.getIcon(gameInfo)
    })

    ipcMain.handle('games:get-meta-batch', async (_, gameInfos) => {
        return await gameManager.getMetaBatch(gameInfos)
    })

    ipcMain.handle('games:launch', async (_, gameInfo) => {
        try {
            const res = await gameManager.launch(gameInfo)
            activeGame = { exeName: res.exeName, gameName: gameInfo.name || '' }
            const windowTitle = gameInfo.windowTitle || gameInfo.name || ''
            if (windowTitle) callbacks.onGameLaunched?.(windowTitle)
            return { success: true, ...res }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('games:is-running-by-name', async (_, exeName) => {
        return await gameManager.isRunningByName(exeName)
    })

    ipcMain.handle('games:get-active', async () => {
        if (!activeGame) return null
        const running = await gameManager.isRunningByName(activeGame.exeName).catch(() => false)
        if (!running) { activeGame = null; return null }
        return activeGame
    })

    ipcMain.handle('games:clear-active', () => {
        activeGame = null
        return true
    })

    // باز کردن لینک دانلود در مرورگر سیستم
    ipcMain.handle('shell:open-external', async (_, url) => {
        const { shell } = require('electron')
        await shell.openExternal(url)
        return true
    })

    // dialog انتخاب فایل exe
    ipcMain.handle('games:pick-exe', async () => {
        const { dialog } = require('electron')
        const res = await dialog.showOpenDialog(mainWindow, {
            title: 'انتخاب فایل اجرایی بازی',
            properties: ['openFile'],
            filters: [{ name: 'Executable', extensions: ['exe'] }]
        })
        if (res.canceled || !res.filePaths.length) return null
        return res.filePaths[0]
    })

    // ذخیره مسیر دستی برای بازی سروری (override)
    ipcMain.handle('games:set-override', (_, gameId, exePath) => {
        gameManager.setOverride(gameId, exePath)
        return true
    })

    // افزودن بازی custom (لوکال)
    ipcMain.handle('games:add-custom', (_, name, exePath) => {
        return gameManager.addCustomGame(name, exePath)
    })

    // لیست بازی‌های custom لوکال
    ipcMain.handle('games:get-custom', () => {
        return gameManager.getCustomGames()
    })

    ipcMain.handle('games:remove-custom', (_, gameId) => {
        gameManager.removeCustomGame(gameId)
        return true
    })

    ipcMain.handle('games:update-custom', (_, gameId, exePath, name) => {
        return gameManager.updateCustomGame(gameId, exePath, name)
    })

    // ─────────────── OBS / STREAMING ─────────────────────────────────

    ipcMain.handle('obs:connect', async (_, { port, password }) => {
        const p = port || 4455
        const pw = password || ''

        // first attempt
        let res = await obs.connect(p, pw)
        if (res.success) return res

        // check if OBS process is already running (WebSocket may just be disabled)
        const alreadyRunning = await obs.isProcessRunning()
        if (alreadyRunning) {
            return { success: false, error: 'obs_websocket_disabled' }
        }

        // OBS not running — find and launch it
        try {
            await obs.launchObs()
        } catch (launchErr) {
            return { success: false, error: 'obs_not_found', detail: launchErr.message }
        }

        // wait for OBS to start, then retry up to 4 times
        await new Promise(r => setTimeout(r, 3500))
        for (let i = 0; i < 4; i++) {
            res = await obs.connect(p, pw)
            if (res.success) return res
            await new Promise(r => setTimeout(r, 2000))
        }

        return { success: false, error: 'obs_launch_timeout' }
    })

    ipcMain.handle('obs:disconnect', async () => {
        await obs.disconnect()
        return { success: true }
    })

    ipcMain.handle('obs:status', async () => {
        return await obs.getStatus()
    })

    // حالت خودکار: ساخت scene + Game Capture با پنجره بازی
    ipcMain.handle('obs:setup-scene', async (_, { sceneName, exeName }) => {
        // دیگه جدا لازم نیست — prepareAndStream خودش می‌سازه. نگه‌داشته شده برای سازگاری.
        return { success: true }
    })

    // شروع استریم: scene/capture (در حالت auto) + RTMP + StartStream
    ipcMain.handle('obs:start-stream', async (_, { rtmpUrl, streamKey, auto }) => {
        try {
            await obs.prepareAndStream({ rtmpUrl, streamKey, auto: auto !== false })
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    ipcMain.handle('obs:stop-stream', async () => {
        try {
            await obs.stopStream()
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })

    // ─────────────── NATIVE OVERLAY ──────────────────────────────────

    // Renderer pushes current lobby/voice state → forward to the in-game DLL
    // state = { members: [{id, name, ip, muted}], friends: [string], selfId }
    ipcMain.on('overlay:push-state', (_, state) => {
        overlayNative.pushState(state)
    })

    // ─────────────── SETTINGS ────────────────────────────────────────

    ipcMain.handle('settings:get', (_, key)        => store.get(key))
    ipcMain.handle('settings:set', (_, key, value) => { store.set(key, value); return true })
}

module.exports = { setupIpcHandlers, getTincInstance: () => tinc, performAppCleanup, isCleanupDone: () => cleanupDone }