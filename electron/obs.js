const OBSWebSocket = require('obs-websocket-js').default
const { execFile } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')

const execFileAsync = promisify(execFile)

/**
 * مدیریت OBS از طریق obs-websocket.
 * scene و Game Capture به صورت idempotent ساخته می‌شن (اگه نبودن).
 */
class ObsManager {
    constructor() {
        this.obs = null
        this.connected = false
    }

    async connect(port = 4455, password = '') {
        this.obs = new OBSWebSocket()
        try {
            await this.obs.connect(`ws://127.0.0.1:${port}`, password || undefined)
            this.connected = true
            return { success: true }
        } catch (err) {
            this.connected = false
            return { success: false, error: err.message }
        }
    }

    async disconnect() {
        if (this.obs && this.connected) {
            try { await this.obs.disconnect() } catch {}
            this.connected = false
        }
    }

    _ensure() {
        if (!this.connected) throw new Error('OBS متصل نیست')
    }

    // scene رو می‌سازه (اگه نبود) و فعالش می‌کنه
    async _ensureScene(sceneName) {
        const { scenes } = await this.obs.call('GetSceneList')
        const exists = scenes.some(s => s.sceneName === sceneName)
        if (!exists) {
            await this.obs.call('CreateScene', { sceneName })
        }
        await this.obs.call('SetCurrentProgramScene', { sceneName })
    }

    // Game Capture source رو می‌سازه (اگه نبود) — حالت any_fullscreen
    async _ensureGameCapture(sceneName, inputName = 'TarGame-Capture') {
        const { inputs } = await this.obs.call('GetInputList')
        const exists = inputs.some(i => i.inputName === inputName)
        if (!exists) {
            await this.obs.call('CreateInput', {
                sceneName,
                inputName,
                inputKind: 'game_capture',
                inputSettings: {
                    capture_mode: 'any_fullscreen',
                    allow_transparency: false,
                },
                sceneItemEnabled: true,
            })
        }
    }

    // تنظیم رزولوشن و fps خروجی (جلوگیری از استریم سیاه/خراب)
    async _configureOutput() {
        try {
            await this.obs.call('SetVideoSettings', {
                baseWidth: 1920,
                baseHeight: 1080,
                outputWidth: 1280,
                outputHeight: 720,
                fpsNumerator: 60,
                fpsDenominator: 1,
            })
        } catch {}
    }

    async setStreamSettings(rtmpUrl, streamKey) {
        this._ensure()
        await this.obs.call('SetStreamServiceSettings', {
            streamServiceType: 'rtmp_custom',
            streamServiceSettings: { server: rtmpUrl, key: streamKey },
        })
    }

    async startStream() {
        this._ensure()
        await this.obs.call('StartStream')
        return { success: true }
    }

    async stopStream() {
        this._ensure()
        try { await this.obs.call('StopStream') } catch {}
        return { success: true }
    }

    async isProcessRunning() {
        try {
            const { stdout } = await execFileAsync('tasklist',
                ['/FI', 'IMAGENAME eq obs64.exe', '/NH'],
                { windowsHide: true })
            return stdout.toLowerCase().includes('obs64.exe')
        } catch {
            return false
        }
    }

    async findObsPath() {
        const common = [
            'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
            'C:\\Program Files (x86)\\obs-studio\\bin\\64bit\\obs64.exe',
        ]
        // check uninstall registry (most reliable across versions)
        try {
            const { stdout } = await execFileAsync('reg', [
                'query',
                'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OBS Studio',
                '/v', 'InstallLocation'
            ], { windowsHide: true })
            const m = stdout.match(/InstallLocation\s+REG_\w+\s+(.+)/)
            if (m) {
                const p = path.join(m[1].trim(), 'bin', '64bit', 'obs64.exe')
                if (fs.existsSync(p)) return p
            }
        } catch {}
        for (const p of common) if (fs.existsSync(p)) return p
        return null
    }

    async launchObs() {
        const exePath = await this.findObsPath()
        if (!exePath) throw new Error('OBS Studio پیدا نشد. لطفاً آن را نصب کنید.')
        const child = require('child_process').spawn(exePath, ['--minimize-to-tray'], {
            cwd: path.dirname(exePath), detached: true, stdio: 'ignore'
        })
        child.unref()
        return exePath
    }

    async getStatus() {
        if (!this.connected) return { connected: false, streaming: false }
        try {
            const res = await this.obs.call('GetStreamStatus')
            return { connected: true, streaming: res.outputActive, timecode: res.outputTimecode }
        } catch {
            return { connected: true, streaming: false }
        }
    }

    /**
     * استریم خودکار: scene + Game Capture می‌سازه، RTMP ست می‌کنه، استریم شروع می‌کنه.
     * auto = true: صحنه TarGame خودکار. auto = false: از صحنه فعلی کاربر استفاده می‌شه.
     */
    async prepareAndStream({ rtmpUrl, streamKey, auto = true, sceneName = 'TarGame' }) {
        this._ensure()

        console.log('[OBS] prepareAndStream auto=', auto, 'rtmp=', rtmpUrl)

        if (auto) {
            try {
                await this._ensureScene(sceneName)
                console.log('[OBS] scene ready:', sceneName)
            } catch (e) { console.log('[OBS] ensureScene error:', e.message) }

            try {
                await this._ensureGameCapture(sceneName)
                console.log('[OBS] game capture ready')
            } catch (e) { console.log('[OBS] ensureGameCapture error:', e.message) }

            try {
                await this._configureOutput()
                console.log('[OBS] output configured')
            } catch (e) { console.log('[OBS] configureOutput error:', e.message) }
        }

        await this.setStreamSettings(rtmpUrl, streamKey)
        console.log('[OBS] stream settings set')

        await this.obs.call('StartStream')
        console.log('[OBS] StartStream called')
        return { success: true }
    }
}

module.exports = { ObsManager }