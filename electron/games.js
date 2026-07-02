const { execFile } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const { GameStore } = require('./gameStore')
const overlayNative = require('./overlay-native')

const execFileAsync = promisify(execFile)

/**
 * تشخیص و لانچ بازی.
 * ترتیب پیدا کردن مسیر exe:
 *   1. override لوکال (اگه کاربر قبلاً دستی انتخاب کرده)
 *   2. بازی custom (با id که custom_ شروع می‌شه)
 *   3. registry (برای بازی‌های سروری)
 */
class GameManager {
    constructor() {
        this.store = new GameStore()
    }

    /**
     * مسیر کامل exe بازی رو پیدا می‌کنه (با fallback های لوکال)
     * gameInfo: { id, name, registryKey, registryValue, exeName }
     */
    async resolveGamePath(gameInfo) {
        const { id, registryKey, registryValue, exeName } = gameInfo

        // ۱. اگه بازی custom هست، مستقیم از store
        if (id && id.startsWith('custom_')) {
            return this.store.getCustomPath(id)
        }

        // ۲. اگه override لوکال داره (قبلاً دستی انتخاب شده)
        if (id) {
            const override = this.store.getOverride(id)
            if (override && fs.existsSync(override)) return override
        }

        // ۳. از registry
        if (!registryKey || !registryValue || !exeName) return null

        let folder = null
        try {
            const hive = registryKey.replace(/^HKLM/, 'HKEY_LOCAL_MACHINE')
            const { stdout } = await execFileAsync('reg',
                ['query', hive, '/v', registryValue],
                { windowsHide: true })
            const match = stdout.match(new RegExp(registryValue + '\\s+REG_\\w+\\s+(.+)', 'i'))
            if (match) folder = match[1].trim()
        } catch {
            return null
        }

        if (!folder) return null

        const exePath = path.join(folder, exeName)
        if (fs.existsSync(exePath)) return exePath

        try {
            const subdirs = fs.readdirSync(folder, { withFileTypes: true }).filter(d => d.isDirectory())
            for (const d of subdirs) {
                const p = path.join(folder, d.name, exeName)
                if (fs.existsSync(p)) return p
            }
        } catch {}

        return null
    }

    async isInstalled(gameInfo) {
        const p = await this.resolveGamePath(gameInfo)
        return p !== null
    }

    /**
     * چک می‌کنه پروسه‌ی بازی روی این سیستم در حال اجراست یا نه
     * (برای تشخیص «در حال بازی» بودن لابی)
     */
    async isRunning(gameInfo) {
        // اسم exe رو از مسیر یا از gameInfo بگیر
        let exeName = gameInfo.exeName
        if (gameInfo.isCustom || !exeName) {
            const p = await this.resolveGamePath(gameInfo)
            if (p) exeName = path.basename(p)
        }
        if (!exeName) return false

        try {
            const { stdout } = await execFileAsync('tasklist',
                ['/FI', `IMAGENAME eq ${exeName}`, '/NH'],
                { windowsHide: true })
            return stdout.toLowerCase().includes(exeName.toLowerCase())
        } catch {
            return false
        }
    }

    /**
     * آیکون لوکال بازی رو از پوشه‌اش می‌خونه (اگه نصب باشه)
     */
    async getIcon(gameInfo) {
        const exePath = await this.resolveGamePath(gameInfo)
        if (!exePath) return null

        const dir = path.dirname(exePath)
        const candidates = [
            path.join(dir, 'Generals.ico'),
            path.join(dir, 'generals.ico'),
            path.join(dir, (gameInfo.exeName || '').replace(/\.exe$/i, '.ico')),
        ]
        for (const ico of candidates) {
            if (ico && fs.existsSync(ico)) {
                try {
                    return `data:image/x-icon;base64,${fs.readFileSync(ico).toString('base64')}`
                } catch {}
            }
        }
        return null
    }

    /**
     * متادیتای چند بازی: { icon, installed } برای هرکدوم.
     * آیکون: اول لوگوی سرور (logoUrl)، اگه نبود آیکون لوکال نصب‌شده.
     */
    async getMetaBatch(gameInfos) {
        const list = gameInfos || []
        return Promise.all(list.map(async (g) => {
            const installed = await this.isInstalled(g).catch(() => false)
            // اولویت با لوگوی سرور؛ در نبودش آیکون لوکال
            let icon = g.logoUrl || null
            if (!icon) icon = await this.getIcon(g).catch(() => null)
            return { icon, installed: installed || !!g.isCustom }
        }))
    }

    async launch(gameInfo) {
        const exePath = await this.resolveGamePath(gameInfo)
        if (!exePath) {
            throw new Error(`بازی ${gameInfo.name || ''} روی سیستم شما یافت نشد`)
        }
        const exeName = path.basename(exePath)
        const cwd = path.dirname(exePath)

        // Deploy the native overlay DLL before the game process starts
        overlayNative.deployDll(exePath)

        const child = require('child_process').spawn(exePath, [], {
            cwd, detached: true, stdio: 'ignore', windowsHide: false
        })
        child.unref()

        // Watch for game exit so we can clean up the DLL
        overlayNative.watchGameExit(exeName)

        return { exePath, exeName, pid: child.pid }
    }

    async isRunningByName(exeName) {
        if (!exeName) return false
        try {
            const { stdout } = await execFileAsync('tasklist',
                ['/FI', `IMAGENAME eq ${exeName}`, '/NH'],
                { windowsHide: true })
            return stdout.toLowerCase().includes(exeName.toLowerCase())
        } catch {
            return false
        }
    }

    // ── مدیریت مسیر دستی ──────────────────────────────────────────────

    // override برای بازی سروری که در registry نبود
    setOverride(gameId, exePath) {
        this.store.setOverride(gameId, exePath)
    }

    // بازی custom جدید
    addCustomGame(name, exePath) {
        return this.store.addCustomGame(name, exePath)
    }

    getCustomGames() {
        return this.store.getCustomGames()
    }

    removeCustomGame(gameId) {
        this.store.removeCustomGame(gameId)
    }

    updateCustomGame(gameId, exePath, name) {
        return this.store.updateCustomGame(gameId, exePath, name)
    }
}

module.exports = { GameManager }