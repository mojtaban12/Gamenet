const { app } = require('electron')
const path = require('path')
const fs = require('fs')

/**
 * مدیریت بازی‌های لوکال در یک فایل JSON:
 * - overrides: مسیر دستی exe برای بازی‌های سروری که در registry پیدا نشدن
 *     { [gameId]: exePath }
 * - customGames: بازی‌هایی که کاربر دستی اضافه کرده (روی سرور نیستن)
 *     [{ id, name, exePath }]
 */
class GameStore {
    constructor() {
        const dir = path.join(app.getPath('userData'))
        this.filePath = path.join(dir, 'games.json')
        this.data = { overrides: {}, customGames: [] }
        this._load()
    }

    _load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf8')
                const parsed = JSON.parse(raw)
                this.data = {
                    overrides:   parsed.overrides   || {},
                    customGames: parsed.customGames || [],
                }
            }
        } catch {
            this.data = { overrides: {}, customGames: [] }
        }
    }

    _save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
        } catch {}
    }

    // ── override مسیر بازی سروری ──────────────────────────────────────

    getOverride(gameId) {
        return this.data.overrides[gameId] || null
    }

    setOverride(gameId, exePath) {
        this.data.overrides[gameId] = exePath
        this._save()
    }

    // ── بازی‌های custom ────────────────────────────────────────────────

    getCustomGames() {
        return this.data.customGames
    }

    // بازی custom اضافه می‌کنه و آبجکتش رو برمی‌گردونه
    addCustomGame(name, exePath) {
        // id یکتا از روی timestamp
        const id = `custom_${Date.now().toString(36)}`
        const game = { id, name, exePath, isCustom: true }
        this.data.customGames.push(game)
        this._save()
        return game
    }

    // مسیر exe یک بازی custom با id
    getCustomPath(gameId) {
        const g = this.data.customGames.find(x => x.id === gameId)
        return g?.exePath || null
    }

    removeCustomGame(gameId) {
        this.data.customGames = this.data.customGames.filter(x => x.id !== gameId)
        this._save()
    }

    // ویرایش exe (و اختیاری نام) یک بازی custom
    updateCustomGame(gameId, exePath, name) {
        const g = this.data.customGames.find(x => x.id === gameId)
        if (g) {
            if (exePath) g.exePath = exePath
            if (name) g.name = name
            this._save()
        }
        return g
    }
}

module.exports = { GameStore }