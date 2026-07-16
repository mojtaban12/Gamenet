const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
const RUNNER_FILENAME = 'watchdog-runner.js'

const TASK_NAME = 'TarGameCrashCleanup'
const HEARTBEAT_DEFAULT_MS = 10000
// اگه بعد از این مدت از آخرین heartbeat خبری نبود (نه کرش، نه بسته‌شدن عادی —
// هر دو یکسان دیده می‌شن)، واچداگ سرویس‌ها رو کامل جمع می‌کنه.
const STALE_THRESHOLD_DEFAULT_MS = 60000

function _markerDir() {
    return path.join(process.env.ProgramData || 'C:\\ProgramData', 'TarGame', 'watchdog')
}

function _markerPath() {
    return path.join(_markerDir(), 'app-marker.json')
}

function _logPath() {
    return path.join(_markerDir(), 'last-run.log')
}

function writeLog(line) {
    try {
        _ensureMarkerDir()
        fs.appendFileSync(_logPath(), `${new Date().toISOString()} ${line}\n`, 'utf8')
    } catch {}
}

function _ensureMarkerDir() {
    fs.mkdirSync(_markerDir(), { recursive: true })
}

function writeMarker({ pid, startedAt, exeName }) {
    _ensureMarkerDir()
    const marker = { pid, startedAt, exeName, lastBeatAt: Date.now() }
    fs.writeFileSync(_markerPath(), JSON.stringify(marker), 'utf8')
}

function clearCrashMarker() {
    try { fs.unlinkSync(_markerPath()) } catch {}
}

function readMarker() {
    try {
        const raw = fs.readFileSync(_markerPath(), 'utf8')
        return JSON.parse(raw)
    } catch {
        return null
    }
}

async function isPidRunning(pid) {
    if (!pid) return false
    try {
        const { stdout } = await execFileAsync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { windowsHide: true })
        const out = (stdout || '').trim()
        // وقتی پروسه‌ای با این pid نباشه، tasklist به‌جای خروجی خالی، پیام
        // «INFO: No tasks are running...» رو روی stdout می‌نویسه — پس فقط چک
        // «stdout غیرخالیه» کافی نیست و همیشه true برمی‌گشت (باگ اصلی که باعث
        // می‌شد واچداگ هیچ‌وقت اپِ بسته‌شده رو تشخیص نده).
        if (!out || /no tasks/i.test(out)) return false
        return out.includes(String(pid))
    } catch {
        return false
    }
}

// چک با نام exe هم (نه فقط pid مارکر) — پوشش حالت «اپ همون لحظه ری‌استارت شده و
// pid جدید گرفته». مهم: خودِ پروسه‌ی واچداگ هم همین exe (همون TarGame.exe) رو
// اجرا می‌کنه (با ELECTRON_RUN_AS_NODE=1)، پس فقط با IMAGENAME نمی‌شه فرق گذاشت —
// باید command line رو هم چک کرد و پروسه‌هایی که watchdog-runner.js رو اجرا
// کردن (یعنی خودِ واچداگ) رو کنار گذاشت، وگرنه واچداگ همیشه خودش رو «اپ زنده»
// تشخیص می‌ده و هیچ‌وقت پاک‌سازی نمی‌کنه.
async function isExeRunning(exeName) {
    if (!exeName) return false
    try {
        const ps = `(Get-CimInstance Win32_Process -Filter "Name='${exeName}'" | Where-Object { $_.CommandLine -notlike '*${RUNNER_FILENAME}*' } | Select-Object -First 1).ProcessId`
        const { stdout } = await execFileAsync('powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            { windowsHide: true })
        return !!(stdout && stdout.trim().length > 0)
    } catch {
        return false
    }
}

async function isAppRunning(marker) {
    if (!marker) return false
    if (await isPidRunning(marker.pid)) return true
    if (await isExeRunning(marker.exeName)) return true
    return false
}

function _wrapperPath() {
    return path.join(_markerDir(), 'run-watchdog.cmd')
}

// قبلاً این Task مستقیم کل TarGame.exe رو در حالت GUI عادی صدا می‌زد (با فلگ
// --crash-watchdog). مشکل: وقتی Task Scheduler با یوزر SYSTEM (بدون سشن
// دسکتاپ/Session 0) این رو اجرا می‌کرد، Chromium/GPU خیلی وقت‌ها درست بالا
// نمی‌اومد و پروسه بدون رسیدن به کد ما می‌بست — یعنی پاک‌سازی هیچ‌وقت واقعاً
// اجرا نمی‌شد، حتی با exit code موفق.
//
// فیکس: به‌جای GUI mode، از ELECTRON_RUN_AS_NODE=1 استفاده می‌کنیم — همون
// باینری TarGame.exe رو صدا می‌زنیم ولی بهش می‌گیم فقط مثل Node ساده رفتار
// کن (بدون هیچ پنجره/Chromium)، و مستقیم watchdog-runner.js رو اجرا کن.
function ensureCrashWatchdogScheduledTask({ exePath, appPath }) {
    // Scheduled task creation requires Windows & schtasks.exe.
    if (process.platform !== 'win32') return
    if (!exePath || !appPath) return

    const runnerPath = path.join(appPath, 'electron', RUNNER_FILENAME)
    const wrapperPath = _wrapperPath()

    try {
        _ensureMarkerDir()
        const wrapperContent =
            `@echo off\r\n` +
            `set ELECTRON_RUN_AS_NODE=1\r\n` +
            `"${exePath}" "${runnerPath}"\r\n`
        fs.writeFileSync(wrapperPath, wrapperContent, 'utf8')
    } catch {
        return
    }

    const taskDeleteArgs = ['/Delete', '/TN', TASK_NAME, '/F']
    const taskCreateArgs = [
        '/Create',
        '/TN', TASK_NAME,
        '/SC', 'MINUTE',
        '/MO', '1',
        '/RL', 'HIGHEST',
        '/F',
        '/RU', 'SYSTEM',
        '/TR', wrapperPath,
    ]

    // Best-effort: delete then recreate so command line is updated.
    execFile('schtasks.exe', taskDeleteArgs, { windowsHide: true }, () => {
        execFile('schtasks.exe', taskCreateArgs, { windowsHide: true }, () => {})
    })
}

function startCrashMarkerHeartbeat({ intervalMs = HEARTBEAT_DEFAULT_MS } = {}) {
    const pid = process.pid
    const startedAt = Date.now()
    const exeName = path.basename(process.execPath)

    writeMarker({ pid, startedAt, exeName })

    const timer = setInterval(() => {
        // Keep pid + startedAt stable, only lastBeatAt changes.
        try { writeMarker({ pid, startedAt, exeName }) } catch {}
    }, intervalMs)

    return timer
}

// این تابع رو Scheduled Task هر ۱ دقیقه صدا می‌زنه (به‌صورت SYSTEM، مستقل از
// اینکه اپ اصلی چطور بسته شده). عمداً بین «کرش» و «بسته‌شدن عادی» فرق نمی‌گذاریم:
// تا وقتی اپ باز نباشه (نه با همون pid، نه با همون exe در هر pid دیگه)، و به‌اندازه‌ی
// staleThresholdMs از آخرین heartbeat گذشته باشه، سرویس نت‌برد و tinc کامل جمع
// می‌شن — حتی اگه کاربر فقط با X بسته باشه و uninstall داخل اپ (به هر دلیلی) اجرا/موفق نشده باشه.
async function runCrashWatchdogOnce({ staleThresholdMs = STALE_THRESHOLD_DEFAULT_MS } = {}) {
    // این تیک هر ۱ دقیقه صدا زده می‌شه (بارها در روز) — عمداً برای حالت‌های
    // نرمال (اپ باز/تازه) چیزی لاگ نمی‌کنیم که last-run.log بی‌نهایت بزرگ نشه؛
    // فقط اقدام واقعی (پاک‌سازی) لاگ می‌شه.
    const marker = readMarker()
    if (!marker || !marker.pid) return { cleaned: false, reason: 'no marker' }

    const lastBeatAt = marker.lastBeatAt ? Number(marker.lastBeatAt) : 0
    const stale = lastBeatAt > 0 && (Date.now() - lastBeatAt) > staleThresholdMs
    if (!stale) return { cleaned: false, reason: 'within grace period' }

    const running = await isAppRunning(marker)
    if (running) return { cleaned: false, reason: 'app alive' }

    const { NetbirdCLI } = require('./netbird')
    const { TincCLI } = require('./tinc')
    const netbird = new NetbirdCLI()
    const tinc = new TincCLI()

    // Full cleanup: stop+down+uninstall core service and stop tinc/TAP.
    writeLog(`cleanup-start pid=${marker.pid} exe=${marker.exeName || 'n/a'}`)
    let nbErr = null
    let tincErr = null
    try { await netbird.stopAndUninstall() } catch (e) { nbErr = e?.message || String(e) }
    try { await tinc.stop() } catch (e) { tincErr = e?.message || String(e) }
    writeLog(`cleanup-end netbirdErr=${nbErr ? nbErr : 'none'} tincErr=${tincErr ? tincErr : 'none'}`)

    clearCrashMarker()
    return { cleaned: true, reason: 'app closed (crash or normal quit)' }
}

module.exports = {
    ensureCrashWatchdogScheduledTask,
    startCrashMarkerHeartbeat,
    clearCrashMarker,
    runCrashWatchdogOnce,
}

