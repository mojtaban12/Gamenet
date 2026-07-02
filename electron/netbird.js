const { execFile, exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')

const execFileAsync = promisify(execFile)
const execAsync    = promisify(exec)

const BINARY_NAME  = 'tarservice.exe'        // خود باینری netbird (CLI)
const SERVICE_NAME = 'Netbird'              // اسم واقعی سرویس ویندوز که netbird می‌سازد
const FW_RULE_NAME = 'TarGame P2P'          // اسم رول فایروال

class NetbirdCLI {
    constructor() {
        this.vendorDir  = this._resolveVendorDir()
        // باینری همون فایل vendor ماست (CLI netbird)
        this.binaryPath = path.join(this.vendorDir, BINARY_NAME)

        // ── watchdog / auto-reconnect state ────────────────────────────
        this.managementUrl  = null   // آخرین URL موفق — برای reconnect بدون key
        this._watchdogTimer = null
        this._reconnecting  = false
        this._enabled       = false  // وقتی false شد، watchdog کاری نمی‌کنه (خروج/logout)
        this._lastIp        = null   // آخرین IP سالم — همون باید بعد از reconnect بمونه
    }

    _resolveVendorDir() {
        try {
            const { app } = require('electron')
            if (app.isPackaged) {
                const inVendor = path.join(process.resourcesPath, 'vendor')
                if (fs.existsSync(path.join(inVendor, BINARY_NAME))) return inVendor
                return process.resourcesPath   // stub installer puts binaries directly in resources/
            }
        } catch {}
        return path.join(__dirname, '../vendor')
    }

    // ─────────────── BINARY PATH ──────────────────────────────────────
    // باینری همون فایل vendor ماست
    async _resolveBinaryPath() {
        if (!fs.existsSync(this.binaryPath)) {
            throw new Error(`فایل ${BINARY_NAME} در vendor یافت نشد:\n${this.binaryPath}`)
        }
        return this.binaryPath
    }

    // ─────────────── INSTALL ───────────────────────────────────────────

    async isInstalled() {
        try {
            const { stdout } = await execAsync(`sc query "${SERVICE_NAME}"`, { windowsHide: true })
            // اگه سرویس نباشه، sc روی stderr/خروجی «does not exist» می‌ده یا throw می‌کنه
            const out = (stdout || '').toLowerCase()
            if (out.includes('does not exist') || out.includes('1060')) return false
            // وجود سرویس: خروجی شامل اسم سرویس یا STATE هست
            return out.includes(SERVICE_NAME.toLowerCase()) || out.includes('state')
        } catch (e) {
            // sc با کد 1060 (سرویس وجود ندارد) throw می‌کنه → نصب نیست
            // ولی خطاهای دیگه رو هم false در نظر بگیر
            return false
        }
    }

    async install() {
        if (!fs.existsSync(this.binaryPath)) {
            throw new Error(`فایل ${BINARY_NAME} در vendor یافت نشد:\n${this.binaryPath}`)
        }

        // اگه سرویس از قبل نصبه، فقط فایروال رو مطمئن شو (profile رو پاک نکن
        // وگرنه auth می‌پره و SSO باز می‌شه)
        if (await this.isInstalled()) {
            await this._ensureFirewallRule().catch(e => console.log('[fw]', e.message))
            await execFileAsync('sc', ['config', SERVICE_NAME, 'DisplayName=', 'TarGame Core Service'],
                { windowsHide: true }).catch(() => {})
            return true
        }

        // اپ admin هست. netbird CLI خودش سرویس ویندوز رو نصب می‌کنه
        // با اسم کاستوم (بدون MSI، بدون UI client، بدون آیکون tray):
        //   tarservice.exe service install
        //   tarservice.exe service start
        try {
            const { stdout, stderr } = await execFileAsync(this.binaryPath, ['service', 'install'],
                { cwd: this.vendorDir, windowsHide: true })
            console.log('[netbird service install]', stdout, stderr)
        } catch (err) {
            // اگه سرویس از قبل بود، install خطا می‌ده — بی‌ضرره
            console.log('[netbird service install ERR]', err.message, err.stderr)
        }

        await sleep(1500)

        try {
            await execFileAsync(this.binaryPath, ['service', 'start'],
                { cwd: this.vendorDir, windowsHide: true })
        } catch (err) {
            console.log('[netbird service start]', err.message)
        }

        // رول فایروال برای P2P (ترافیک UDP ورودی به سرویس) — جلوگیری از relay
        await this._ensureFirewallRule().catch(e => console.log('[fw]', e.message))

        // display name سرویس رو عوض کن تا توی Services.msc مخفی بمونه
        await execFileAsync('sc', ['config', SERVICE_NAME, 'DisplayName=', 'TarGame Core Service'],
            { windowsHide: true }).catch(() => {})

        await sleep(2000)
        if (await this.isInstalled()) return true

        await sleep(3000)
        if (await this.isInstalled()) return true
        throw new Error('نصب سرویس شبکه ناموفق بود')
    }

    // رول فایروال ورودی UDP برای باینری+سرویس (P2P به جای relay)
    async _ensureFirewallRule() {
        const ps = `
$ErrorActionPreference = 'Stop'
$existing = Get-NetFirewallRule -DisplayName '${FW_RULE_NAME}' -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule -DisplayName '${FW_RULE_NAME}' -Direction Inbound -Action Allow -Protocol UDP -Program '${this.binaryPath.replace(/'/g, "''")}' -Service '${SERVICE_NAME}'
  Write-Output 'CREATED'
} else {
  Write-Output 'EXISTS'
}
`.trim()
        try {
            const { stdout, stderr } = await execFileAsync('powershell.exe',
                ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
                { windowsHide: true })
            console.log('[fw TarGame P2P]', stdout.trim(), stderr ? `ERR:${stderr}` : '')
        } catch (e) {
            console.log('[fw TarGame P2P] FAILED:', e.message, e.stderr)
        }
    }

    // ─────────────── CONNECTION ────────────────────────────────────────

    async connect(managementUrl, setupKey = null, hostname = null) {
        const bin = await this._resolveBinaryPath()

        // URL رو نگه دار تا watchdog بتونه بدون key دوباره up بزنه (همون IP حفظ می‌شه)
        if (managementUrl) this.managementUrl = managementUrl

        // مطمئن شو رول فایروال P2P هست
        await this._ensureFirewallRule().catch(e => console.log('[fw]', e.message))

        // فقط در ثبت‌نام اولیه (با key) اول down بزن + profile قدیمی رو پاک کن
        // تا URL قدیمی (مثلاً :443) و session قبلی نمونه. در reconnect (بدون key)
        // هرگز این کار رو نکن — وگرنه auth می‌پره و SSO باز می‌شه.
        if (setupKey) {
            try {
                await execFileAsync(bin, ['down'], { windowsHide: true, timeout: 8000 })
                await sleep(1000)
            } catch (e) {
                console.log('[netbird down]', e.message)
            }
            await this.resetProfile().catch(e => console.log('[resetProfile]', e.message))

            // ثبت با اسم دلخواه (نام کاربر) — workaround نت‌برد: login --hostname سپس up
            // (فلگ --hostname روی up مستقیماً اعمال نمی‌شه؛ باید موقع login باشه)
            const loginArgs = ['login', '--management-url', managementUrl, '--setup-key', setupKey]
            // نت‌برد فقط حروف/عدد/خط‌تیره قبول می‌کنه
            const safeName = hostname ? String(hostname).replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) : null
            if (safeName) loginArgs.push('--hostname', safeName)
            try {
                await execFileAsync(bin, loginArgs, { windowsHide: true, cwd: this.vendorDir, timeout: 30000 })
                await sleep(800)
            } catch (e) {
                console.log('[netbird login]', e.message, e.stderr)
            }
        }

        // بعد از login با key، up دیگه نیازی به key نداره (peer ثبت شده)
        // اگه hostname نبود و login نزدیم، key رو روی up بذار.
        // --management-url فقط وقتی که داریمش؛ در reconnect بدون URL، نت‌برد از
        // پروفایلِ ذخیره‌شده استفاده می‌کنه (همون identity ⇒ همون IP).
        const args = ['up', '--mtu', '1448', '--wireguard-port', '51820']
        if (managementUrl) args.splice(1, 0, '--management-url', managementUrl)
        if (setupKey && !hostname) args.push('--setup-key', setupKey)

        return new Promise((resolve, reject) => {
            // cwd = vendorDir مهمه: wintun.dll باید کنار باینری باشه
            const proc = require('child_process').spawn(bin, args, {
                windowsHide: true,
                cwd: this.vendorDir
            })
            let output = ''
            proc.stdout?.on('data', d => { output += d.toString(); console.log('[nb]', d.toString().trim()) })
            proc.stderr?.on('data', d => { output += d.toString(); console.log('[nb ERR]', d.toString().trim()) })
            proc.on('close', (code) => {
                console.log('[netbird up] exit code:', code)
                if (code === 0 || code === 1) resolve({ success: true, output })
                else reject(new Error(output || `Exit code ${code}`))
            })
            proc.on('error', reject)
        })
    }

    // پاک کردن profile/state قدیمی سرویس (جلوگیری از login بدون key با URL قدیمی)
    async resetProfile() {
        try {
            await execFileAsync(this.binaryPath, ['service', 'stop'],
                { windowsHide: true, timeout: 8000 })
            await sleep(1000)
        } catch {}

        const ps = `
$paths = @(
  "$env:APPDATA\\Netbird",
  "C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming\\Netbird",
  "C:\\ProgramData\\Netbird"
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    Remove-Item "$p\\*.json" -Force -ErrorAction SilentlyContinue
    Remove-Item "$p\\*.db"   -Force -ErrorAction SilentlyContinue
    Write-Output "CLEANED: $p"
  }
}
`.trim()
        try {
            const { stdout } = await execFileAsync('powershell.exe',
                ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
                { windowsHide: true })
            console.log('[resetProfile]', stdout.trim())
        } catch (e) {
            console.log('[resetProfile ERR]', e.message)
        }

        try {
            await execFileAsync(this.binaryPath, ['service', 'start'],
                { windowsHide: true, timeout: 8000 })
            await sleep(2000)
        } catch {}
    }

    // قطع اتصال (wt0/route/DNS برداشته می‌شه) — سرویس نصب می‌مونه.
    // timeout داره تا اگه daemon گیر کرد، روی بستن اپ بی‌نهایت بلاک نکنه.
    async disconnect(timeoutMs = 8000) {
        this.stopWatchdog()   // قطع عمدی — watchdog نباید دوباره وصلش کنه
        try {
            const bin = await this._resolveBinaryPath()
            await execFileAsync(bin, ['down'], { windowsHide: true, timeout: timeoutMs })
            return true
        } catch {
            return false
        }
    }

    /**
     * موقع بستن اپ: قطع اتصال + توقف و حذف کامل سرویس ویندوز
     * تا روی سرور کاربر آنلاین نمونه و سرویس زامبی توی ویندوز نمونه.
     */
    async stopAndUninstall() {
        this.stopWatchdog()   // logout — دیگه نباید reconnect بشه
        this.managementUrl = null
        const bin = this.binaryPath
        // 1) down — قطع اتصال (کاربر از سرور آفلاین شه)
        try { await execFileAsync(bin, ['down'], { windowsHide: true, timeout: 8000 }) } catch (e) { console.log('[nb down]', e.message) }
        await sleep(800)
        // 2) service stop
        try { await execFileAsync(bin, ['service', 'stop'], { windowsHide: true, timeout: 8000 }) } catch (e) { console.log('[nb svc stop]', e.message) }
        await sleep(800)
        // 3) service uninstall
        try { await execFileAsync(bin, ['service', 'uninstall'], { windowsHide: true, timeout: 8000 }) } catch (e) { console.log('[nb svc uninstall]', e.message) }
        return true
    }

    // ─────────────── STATUS ────────────────────────────────────────────

    async getStatus() {
        try {
            const bin = await this._resolveBinaryPath()
            const { stdout } = await execFileAsync(
                bin, ['status', '--json'],
                { windowsHide: true, timeout: 8000 }
            )
            const data = JSON.parse(stdout)
            return this._parseStatus(data)
        } catch {
            return { connected: false, ip: null, peerId: null, peers: [] }
        }
    }

    _parseStatus(data) {
        return {
            connected: data?.daemonStatus === 'Connected',
            ip:        data?.netbirdIp?.split('/')?.[0]?.trim() || null,
            fqdn:      data?.fqdn || null,
            peerId:    null,
            peers: (data?.peers?.details || []).map(p => ({
                name:      p.fqdn,
                ip:        p.netbirdIp,
                connected: p.status === 'Connected'
            }))
        }
    }

    async waitForConnection(timeoutMs = 20000) {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
            const status = await this.getStatus()
            if (status.connected && status.ip) return status
            await sleep(1500)
        }
        throw new Error('اتصال برقرار نشد — timeout')
    }

    // ─────────────── AUTO-RECONNECT (WATCHDOG) ────────────────────────
    //
    // بعد از قطعی/تغییر اینترنت، گاهی daemon نت‌برد خودش بالا نمی‌آد و کاربر
    // مجبور می‌شد logout/login کنه. این متد بدون setup-key و بدون reset پروفایل
    // فقط `up` می‌زنه؛ چون هویتِ peer (کلید WireGuard) دست‌نخورده می‌مونه، سرور
    // **همون IP قبلی** رو دوباره می‌ده.
    async reconnect() {
        const bin = await this._resolveBinaryPath()
        // مطمئن شو سرویس (daemon) بالاست — بعد از resume/تغییر شبکه ممکنه گیر کرده باشه
        try {
            await execFileAsync(bin, ['service', 'start'], { windowsHide: true, timeout: 8000 })
        } catch {}
        // up بدون key ⇒ همون identity ⇒ همون IP
        await this.connect(this.managementUrl)
        return this.waitForConnection(20000)
    }

    // پایش دوره‌ای اتصال. onChange با وضعیت فعلی صدا زده می‌شه تا UI به‌روز بمونه.
    startWatchdog(onChange, intervalMs = 12000) {
        this.stopWatchdog()
        this._enabled = true
        this._watchdogTimer = setInterval(() => {
            this._watchdogTick(onChange).catch(() => {})
        }, intervalMs)
    }

    stopWatchdog() {
        this._enabled = false
        if (this._watchdogTimer) {
            clearInterval(this._watchdogTimer)
            this._watchdogTimer = null
        }
    }

    async _watchdogTick(onChange) {
        if (!this._enabled || this._reconnecting) return

        let status
        try { status = await this.getStatus() } catch { return }
        if (!this._enabled) return

        if (status.connected && status.ip) {
            this._lastIp = status.ip
            onChange?.({ ...status, reconnecting: false })
            return
        }

        // قطع شده — تلاش برای بالا آوردن مجدد با همون IP.
        // (managementUrl لازم نیست؛ نت‌برد از پروفایلِ ذخیره‌شده می‌خونه.)
        this._reconnecting = true
        onChange?.({ connected: false, ip: this._lastIp, reconnecting: true })
        try {
            const after = await this.reconnect()
            if (!this._enabled) return
            if (after?.ip) this._lastIp = after.ip
            onChange?.({ ...after, reconnecting: false })
        } catch (e) {
            console.log('[nb watchdog reconnect]', e.message)
            onChange?.({ connected: false, ip: this._lastIp, reconnecting: false })
        } finally {
            this._reconnecting = false
        }
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

module.exports = { NetbirdCLI }