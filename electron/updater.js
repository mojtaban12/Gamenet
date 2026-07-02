const { app, dialog } = require('electron')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const CDN_BASE = process.env.UPDATE_FEED_URL?.replace(/\/$/, '') || 'https://s3.blockbone.ir/targame'

// ── Called at startup ────────────────────────────────────────────────────────
function applyPendingUpdates() {
    if (!app.isPackaged) return
    const root = path.dirname(app.getPath('exe'))
    for (const f of [
        path.join(root, 'app.update.tmp'),
        path.join(root, 'update.ps1'),
        path.join(root, 'resources', 'app.asar.old'),
    ]) try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch {}
}

// ── Download helper ──────────────────────────────────────────────────────────
function downloadFile(url, destPath, onProgress, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
        const mod  = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(destPath)
        let settled = false
        const done  = (fn, arg) => { if (!settled) { settled = true; fn(arg) } }

        const req = mod.get(url, res => {
            if (res.statusCode !== 200) {
                res.resume(); file.close()
                return done(reject, new Error(`HTTP ${res.statusCode}`))
            }
            const total = parseInt(res.headers['content-length'] || '0', 10)
            let downloaded = 0
            res.on('data', chunk => {
                downloaded += chunk.length
                if (onProgress) onProgress({ percent: total > 0 ? (downloaded / total) * 100 : -1 })
            })
            res.pipe(file)
            file.on('finish', () => { file.close(); done(resolve) })
            file.on('error', err => { fs.unlink(destPath, () => {}); done(reject, err) })
        })
        req.on('error', err => { file.close(); fs.unlink(destPath, () => {}); done(reject, err) })
        req.setTimeout(timeoutMs, () => req.destroy(new Error('Download timed out')))
    })
}

// ── AppUpdater ────────────────────────────────────────────────────────────────
class AppUpdater extends EventEmitter {
    constructor() {
        super()
        this._appRoot     = app.isPackaged ? path.dirname(app.getPath('exe')) : null
        this._asarPending = app.isPackaged ? path.join(this._appRoot, 'app.update.tmp') : null
    }

    async downloadAndStage() {
        await downloadFile(`${CDN_BASE}/app.asar`, this._asarPending, ({ percent }) => {
            if (percent >= 0) this.emit('progress', { percent })
        })
        this.emit('ready')
    }

    relaunch() {
        if (!app.isPackaged) {
            app.relaunch()
            app.exit(0)
            return
        }

        const asarDest   = path.join(this._appRoot, 'resources', 'app.asar')
        const exePath    = app.getPath('exe')
        const scriptPath = path.join(this._appRoot, 'update.ps1')
        const q = s => s.replace(/'/g, "''")

        const ps1 = `
$src  = '${q(this._asarPending)}'
$dst  = '${q(asarDest)}'
$exe  = '${q(exePath)}'
$name = 'TarGame'

# Wait for app to fully exit
$i = 0
while ((Get-Process $name -ErrorAction SilentlyContinue) -and $i -lt 30) {
    Start-Sleep -Milliseconds 500
    $i++
}

# Rename old, move new in
$old = $dst + '.old'
if (Test-Path $old) { Remove-Item $old -Force }
Rename-Item -Path $dst -NewName ($dst + '.old') -Force
Move-Item   -Path $src -Destination $dst -Force
Remove-Item $old -Force -ErrorAction SilentlyContinue

# Relaunch via Shell so Windows handles elevation properly
$psi = New-Object System.Diagnostics.ProcessStartInfo($exe)
$psi.UseShellExecute = $true
[System.Diagnostics.Process]::Start($psi) | Out-Null
`
        fs.writeFileSync(scriptPath, ps1, 'utf8')

        // spawn() puts the child in Electron's Job Object — it dies when Electron exits.
        // cmd /c start "" creates the process outside that Job Object.
        require('child_process').exec(
            `start "" /min powershell.exe -ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -Command "& '${scriptPath.replace(/'/g, "''")}'"`,
            { windowsHide: true }
        )
        setTimeout(() => app.exit(0), 300)
    }
}

module.exports = { AppUpdater, applyPendingUpdates }
