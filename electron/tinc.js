const { execFile, exec, spawn } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const os = require('os')
const AdmZip = require('adm-zip')

const execFileAsync = promisify(execFile)
const execAsync     = promisify(exec)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── نام‌های خنثی (مخفی‌سازی) ─────────────────────────────────────────
const NETNAME      = 'gnet'                      // نام شبکه tinc
const SERVICE_NAME = 'TarGameNetwork'            // اسم سرویس ویندوز (خنثی)
const SERVICE_DISPLAY = 'TarGame Network Service'
const BINARY_NAME  = 'gnlocalService.exe'        // اسم خنثی برای tincd.exe
const ADAPTER_NAME = 'TarGame Virtual Adapter'   // اسم خنثی برای TAP
const TAP_DIR      = 'tap-win64'                 // پوشه درایور TAP
const TAP_HWID     = 'tap0901'                   // hardware ID درایور

// مسیر مخفی config (ProgramData)
// آخرین پوشه = netname (چون --config می‌دیم، tinc از اسم پوشه می‌خونه)
const CONFIG_DIR = path.join(
    process.env.ProgramData || 'C:\\ProgramData',
    'TarGame', 'sys', NETNAME
)

class TincCLI {
    constructor() {
        this.vendorDir      = this._resolveVendorDir()
        this.binaryPath     = path.join(this.vendorDir, BINARY_NAME)
        this.configDir      = CONFIG_DIR
        this.netname        = NETNAME
        this._watchdogTimer = null
    }

    _resolveVendorDir() {
        try {
            const { app } = require('electron')
            if (app.isPackaged) {
                const inVendor = path.join(process.resourcesPath, 'vendor')
                if (fs.existsSync(path.join(inVendor, BINARY_NAME))) return inVendor
                return process.resourcesPath
            }
        } catch {}
        return path.join(__dirname, '../vendor')
    }

    // ─────────────── نصب (موقع نصب اپ) ────────────────────────────────

    /**
     * نصب silent: TAP driver + ساخت پوشه config مخفی
     * tinc.exe خودش نصب نمی‌خواد، فقط باید کنار اپ باشه
     */
    async install() {
        // ۱. پوشه config مخفی بساز
        fs.mkdirSync(path.join(this.configDir, 'hosts'), { recursive: true })

        // ۲. TAP driver نصب کن (اگه نصب نیست)
        await this._installTapDriver()

        return { success: true }
    }

    /**
     * نصب TAP driver + ساخت آداپتر + rename — با منطق snapshot/PnP
     * (بر اساس HardwareID نه description، چون مطمئن‌تره).
     * اگه آداپتر با اسم درست از قبل هست، کاری نمی‌کنه.
     */
    async _installTapDriver() {
        const tapDir     = path.join(this.vendorDir, TAP_DIR)
        const tapInstall = path.join(tapDir, 'devcon.exe')
        const infFile    = [
            path.join(tapDir, 'OemVista.inf'),
            path.join(tapDir, 'OemWin2k.inf'),
        ].find(p => fs.existsSync(p))

        if (!fs.existsSync(tapInstall) || !infFile) {
            throw new Error('TAP driver files not found')
        }

        if (await this._adapterExists()) return { success: true }

        const ps = `
    $ErrorActionPreference = 'Stop'
    $HardwareId  = '${TAP_HWID}'
    $InfPath     = '${infFile.replace(/'/g, "''")}'
    $TapInstall  = '${tapInstall.replace(/'/g, "''")}'
    $NewName     = '${ADAPTER_NAME}'

    # Validate paths
    if (-not (Test-Path $InfPath))    { Write-Error "INF not found: $InfPath"; exit 1 }
    if (-not (Test-Path $TapInstall)) { Write-Error "devcon not found"; exit 1 }

    # Already renamed and ready?
    if (Get-NetAdapter -Name $NewName -ErrorAction SilentlyContinue) {
        Write-Output 'ALREADY'; exit 0
    }

    function Get-TapInstances {
        Get-PnpDevice | Where-Object {
            $_.HardwareID -like "*$HardwareId*" -and $_.Status -eq 'OK'
        } | Select-Object -ExpandProperty InstanceId
    }

    $before = @(Get-TapInstances)

    # Install and check exit code
    $output = & $TapInstall install $InfPath $HardwareId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "devcon failed (exit $LASTEXITCODE): $output"; exit 1
    }

    # Wait for new adapter to enumerate
    $new = $null
    for ($i = 0; $i -lt 5; $i++) {
        Start-Sleep -Seconds 2
        $after = @(Get-TapInstances)
        $new = $after | Where-Object { $before -notcontains $_ } | Select-Object -First 1
        if ($new) { break }
    }

    if (-not $new) {
        Write-Error "New TAP adapter did not appear after 10 seconds"; exit 1
    }

    # Match PnP instance to NetAdapter
    $adapter = Get-NetAdapter | Where-Object { $_.PnPDeviceID -eq $new }
    if (-not $adapter) {
        Write-Error "PnP device found but no matching NetAdapter for: $new"; exit 1
    }

    # Rename
    Rename-NetAdapter -Name $adapter.Name -NewName $NewName
    Write-Output 'OK'
    `.trim()

        const { stdout } = await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true, maxBuffer: 1024 * 1024 })

        const result = stdout.trim()
        if (result !== 'OK' && result !== 'ALREADY') {
            throw new Error(`TAP install unexpected output: ${result}`)
        }

        if (!await this._adapterExists()) {
            throw new Error('Adapter not found after install — rename may have failed')
        }

        return { success: true }
    }

    // آیا آداپتر با اسم خنثی ما وجود داره؟
    async _adapterExists() {
        try {
            const { stdout } = await execFileAsync('powershell.exe',
                ['-NoProfile', '-Command',
                    `if (Get-NetAdapter -Name '${ADAPTER_NAME}' -ErrorAction SilentlyContinue) { 'YES' } else { 'NO' }`],
                { windowsHide: true })
            return stdout.trim() === 'YES'
        } catch {
            return false
        }
    }

    async _isTapInstalled() {
        return await this._adapterExists()
    }

    async isInstalled() {
        if (!fs.existsSync(this.binaryPath)) return false
        return await this._adapterExists()
    }

    // ─────────────── اعمال config (zip از سرور) ───────────────────────

    /**
     * zip دریافتی از API رو در پوشه config مخفی extract می‌کنه
     */
    async applyConfig(zipBuffer) {
        // tincd رو ببند و مطمئن شو واقعاً بسته شده (تا فایل‌ها قفل نباشن)
        await this._killTincd().catch(() => {})
        await this._waitProcessGone(5000)
        await sleep(500)

        // پاک کردن کل محتوای config dir (با retry برای قفل)
        await this._clearConfigDir()

        // extract zip جدید
        fs.mkdirSync(this.configDir, { recursive: true })
        const zip = new AdmZip(zipBuffer)
        zip.extractAllTo(this.configDir, true) // overwrite

        return { success: true }
    }

    /**
     * به‌روزرسانی «زنده»ی پیکربندی peerها بدون قطع تونل.
     * وقتی کسی وسط بازی join/leave می‌کنه، فقط فایل‌های hosts رو روی همون پوشه
     * بازنویسی می‌کنیم — tincd رو نمی‌کشیم، آداپتر TAP رو disable/enable نمی‌کنیم
     * و config رو پاک نمی‌کنیم. tinc فایل host هر peer رو لحظه‌ی اتصال می‌خونه،
     * پس peer جدید بدون restart و بدون قطعِ اتصال‌های موجود وارد مش می‌شه.
     * (این جایگزین restartِ مخرب قبلیه که باعث قطع/وصل با هر alt+tab می‌شد.)
     */
    async updateHostsLive(zipBuffer) {
        fs.mkdirSync(path.join(this.configDir, 'hosts'), { recursive: true })
        try {
            const zip = new AdmZip(zipBuffer)
            // overwrite=true: فایل‌های host جدید/به‌روز نوشته می‌شن؛ فایل‌های قدیمی
            // (peerهایی که رفتن) دست‌نخورده می‌مونن که بی‌ضرره.
            zip.extractAllTo(this.configDir, true)
        } catch (e) {
            return { success: false, error: e.message }
        }
        // اگه tincd اصلاً بالا نیست (مثلاً refresh قبل از کامل‌شدن bringUp رسید)،
        // همین که فایل‌ها نوشته شدن کافیه؛ start بعدی اون‌ها رو برمی‌داره.
        return { success: true }
    }

    // صبر می‌کنه تا پروسه tincd واقعاً بسته شود
    async _waitProcessGone(timeoutMs = 5000) {
        const imageName = path.basename(this.binaryPath)
        const deadline = Date.now() + timeoutMs
        while (Date.now() < deadline) {
            try {
                const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`], { windowsHide: true })
                if (!stdout.toLowerCase().includes(imageName.toLowerCase())) return  // بسته شده
            } catch { return }
            // هنوز زنده — دوباره kill و صبر
            await this._killTincd().catch(() => {})
            await sleep(400)
        }
    }

    // محتوای config dir رو پاک می‌کنه (hosts + همه فایل‌ها) با retry برای قفل
    async _clearConfigDir() {
        if (!fs.existsSync(this.configDir)) return
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                for (const entry of fs.readdirSync(this.configDir)) {
                    const p = path.join(this.configDir, entry)
                    fs.rmSync(p, { recursive: true, force: true })
                }
                // چک کن خالی شد
                if (fs.readdirSync(this.configDir).length === 0) return
            } catch {}
            // اگه فایلی قفل بود، دوباره kill و صبر و retry
            await this._killTincd().catch(() => {})
            await sleep(500)
        }
    }

    // ─────────────── اجرا (background process) ────────────────────────

    /**
     * tincd رو به صورت یک پروسه پس‌زمینه elevated اجرا می‌کنه (با -D).
     * سرویس ویندوز نمی‌سازیم — چون SCM با foreground process مشکل داره
     * و باعث قطع/وصل می‌شه. این روش پایداره و با بستن اپ هم قطع می‌شه.
     */
    // آداپتر رو disable/enable می‌کنه تا NDIS دوباره rebind بشه، ولی قبلش
    // GUID دستگاه TAP رو در ابتدای HKLM\...\Tcpip\Linkage\Bind می‌ذاره.
    // تنها متریک IP کافی نیست: بازی‌های قدیمی LAN آداپتر شبکه رو با
    // enumeration سطح NDIS/Binding Order پیدا می‌کنن نه با متریک — و چون TAP
    // همیشه آخرِ این لیست نصب می‌شه، همیشه آخرین انتخاب باقی می‌مونه. جابه‌جا
    // کردنش به اول لیست، بعد rebind با disable/enable، هر بار قطعی‌تر جواب
    // می‌ده تا صرفاً reset بدون reorder.
    async _reorderBindRegistry() {
        const ps = `
$name = '${ADAPTER_NAME}'
$adapter = Get-NetAdapter -Name $name -ErrorAction SilentlyContinue
if ($adapter) {
    $device = "\\Device\\$($adapter.InterfaceGuid)"
    $regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Linkage'
    try {
        $bind = (Get-ItemProperty -Path $regPath -Name Bind -ErrorAction Stop).Bind
        $bindList = New-Object System.Collections.Generic.List[string]
        $bindList.AddRange([string[]]$bind)
        $bindList.Remove($device) | Out-Null
        $bindList.Insert(0, $device)
        Set-ItemProperty -Path $regPath -Name Bind -Value $bindList.ToArray() -Type MultiString
    } catch {}
}`.trim()
        await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true, timeout: 15000 })
    }

    async _setAdapterAdminState(up) {
        const ps = up
            ? `$n='${ADAPTER_NAME}'; Enable-NetAdapter -Name $n -Confirm:$false -ErrorAction SilentlyContinue; Enable-NetAdapterBinding -Name $n -ComponentID ms_tcpip -Confirm:$false -ErrorAction SilentlyContinue`
            : `$n='${ADAPTER_NAME}'; Disable-NetAdapterBinding -Name $n -ComponentID ms_tcpip -Confirm:$false -ErrorAction SilentlyContinue; Disable-NetAdapter -Name $n -Confirm:$false -ErrorAction SilentlyContinue`
        await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true, timeout: 15000 })
    }

    async _ensureStopped() {
        await this._killTincd().catch(() => {})
        await this._waitProcessGone(8000)
        const { running } = await this.getStatus()
        if (!running) return true
        await this._killTincd().catch(() => {})
        await this._waitProcessGone(5000)
        return !(await this.getStatus()).running
    }

    _spawnTincd() {
        const child = spawn(
            this.binaryPath,
            ['--config', this.configDir, '-n', this.netname],
            { cwd: this.vendorDir, detached: true, stdio: 'ignore', windowsHide: true }
        )
        child.unref()
    }

    async _setPreMetric() {
        await execFileAsync('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            `Set-NetIPInterface -InterfaceAlias '${ADAPTER_NAME}' -AutomaticMetric Disabled -InterfaceMetric 1 -ErrorAction SilentlyContinue`
        ], { windowsHide: true, timeout: 10000 })
    }

    async _postStartSetup() {
        await this._ensureFirewallRules().catch(e => console.log('[tinc fw]', e.message))
        await this._setAdapterPrivate().catch(e => console.log('[tinc profile]', e.message))
    }

    async _resetAdapter() {
        await this._reorderBindRegistry().catch(e => console.log('[tinc reorder]', e.message))
        const ps = `
$name = '${ADAPTER_NAME}'
Disable-NetAdapterBinding -Name $name -ComponentID ms_tcpip -Confirm:$false -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Enable-NetAdapterBinding -Name $name -ComponentID ms_tcpip -Confirm:$false -ErrorAction SilentlyContinue`.trim()
        await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true, timeout: 15000 })
    }

    /**
     * قطع کامل tincd + آداپتر، reorder، و استارت مجدد (برای hotkey تعمیر شبکه).
     */
    async hardReset() {
        this._stopWatchdog()
        await this._ensureStopped()

        await this._setAdapterAdminState(false).catch(e => console.log('[tinc disable]', e.message))
        await sleep(600)
        await this._reorderBindRegistry().catch(e => console.log('[tinc reorder]', e.message))
        await sleep(300)
        await this._setAdapterAdminState(true).catch(e => console.log('[tinc enable]', e.message))
        await sleep(600)

        if ((await this.getStatus()).running) {
            await this._ensureStopped()
        }

        const hasConf = fs.existsSync(path.join(this.configDir, 'tinc.conf'))
        if (!hasConf) {
            return { success: true, restarted: false, running: false }
        }

        if (!await this._adapterExists()) {
            await this._installTapDriver().catch(() => {})
        }

        await this._resetAdapter().catch(e => console.log('[tinc reset]', e.message))
        await this._setPreMetric().catch(e => console.log('[tinc metric]', e.message))
        this._spawnTincd()
        await sleep(2000)
        await this._postStartSetup()
        this._startWatchdog()

        const { running } = await this.getStatus()
        return { success: true, restarted: true, running }
    }

    async start() {
        await this._killTincd().catch(() => {})

        if (!await this._adapterExists()) {
            await this._installTapDriver().catch(() => {})
        }

        await this._resetAdapter().catch(e => console.log('[tinc reset]', e.message))
        await this._setPreMetric().catch(e => console.log('[tinc metric]', e.message))
        this._spawnTincd()
        await sleep(2000)
        await this._postStartSetup()
        this._startWatchdog()
        return { success: true }
    }

    _startWatchdog() {
        this._stopWatchdog()
        const check = async () => {
            try {
                const { running } = await this.getStatus()
                if (running) {
                    // سرویس بالاست — 5 ثانیه دیگه چک کن
                    this._watchdogTimer = setTimeout(check, 5000)
                    return
                }
                console.log('[tinc watchdog] not running — restarting')
                const child = spawn(
                    this.binaryPath,
                    ['--config', this.configDir, '-n', this.netname],
                    { cwd: this.vendorDir, detached: true, stdio: 'ignore', windowsHide: true }
                )
                child.unref()
            } catch (e) {
                console.log('[tinc watchdog] error:', e.message)
            }
            this._watchdogTimer = setTimeout(check, 5000)
        }
        this._watchdogTimer = setTimeout(check, 5000)
    }

    _stopWatchdog() {
        if (this._watchdogTimer) {
            clearTimeout(this._watchdogTimer)
            this._watchdogTimer = null
        }
    }

    async _ensureFirewallRules() {
        const ps = `
$ErrorActionPreference = 'SilentlyContinue'
# پورت کنترل tinc بین peerها
if (-not (Get-NetFirewallRule -DisplayName 'TarGame Network' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'TarGame Network' -Direction Inbound -Action Allow -Protocol UDP -LocalPort 655 -Profile Any | Out-Null
}
# ترافیک بازی روی subnet تینک — delete+add برای اطمینان از تازه بودن
netsh advfirewall firewall delete rule name="GameCenter Allow Inbound" >nul 2>&1
netsh advfirewall firewall delete rule name="GameCenter Allow Outbound" >nul 2>&1
netsh advfirewall firewall add rule name="GameCenter Allow Inbound"  dir=in  action=allow remoteip=192.168.100.0/24 protocol=any profile=any
netsh advfirewall firewall add rule name="GameCenter Allow Outbound" dir=out action=allow remoteip=192.168.100.0/24 protocol=any profile=any
`.trim()
        await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true })
    }

    // آداپتر TAP رو با retry به Private تبدیل کن (ممکنه بلافاصله بعد از spawn آماده نباشه)
    async _setAdapterPrivate() {
        const ps = `
for ($i = 0; $i -lt 8; $i++) {
    if (Get-NetAdapter -Name '${ADAPTER_NAME}' -ErrorAction SilentlyContinue) {
        Set-NetConnectionProfile -InterfaceAlias '${ADAPTER_NAME}' -NetworkCategory Private -ErrorAction SilentlyContinue
        Write-Output 'OK'; break
    }
    Start-Sleep -Seconds 1
}`.trim()
        await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true })
    }

    async stop() {
        this._stopWatchdog()
        await this._killTincd().catch(() => {})
        await this._waitProcessGone(3000)
        await this._clearConfigDir().catch(() => {})
        return { success: true }
    }

    /**
     * پروسه tincd رو می‌کشه (اپ admin هست، نیازی به elevation نیست)
     */
    async _killTincd() {
        await execFileAsync(
            this.binaryPath,
            ['--config', this.configDir, '-n', this.netname, '-k'],
            { windowsHide: true }
        ).catch(() => {})
    }

    /**
     * config جدید اعمال شد → پروسه رو restart کن
     */
    async restart(zipBuffer) {
        // applyConfig خودش tincd رو می‌بنده (آزاد شدن قفل فایل‌ها)،
        // hosts قدیمی رو پاک و config جدید رو extract می‌کنه
        await this.applyConfig(zipBuffer)
        await this.start()
        return { success: true }
    }
    async getStatus() {
        try {
            const imageName = path.basename(this.binaryPath)
            const { stdout } = await execAsync(
                `tasklist /FI "IMAGENAME eq ${imageName}" /NH`,
                { windowsHide: true })
            const running = stdout.toLowerCase().includes(imageName.toLowerCase())
            return { installed: fs.existsSync(this.binaryPath), running }
        } catch {
            return { installed: false, running: false }
        }
    }
}

module.exports = { TincCLI }