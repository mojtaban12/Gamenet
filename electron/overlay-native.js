// overlay-native.js
// Manages the native in-game overlay DLL:
//   - Named pipe server (Electron = server, DLL = client)
//   - Copying version.dll to the game directory before launch
//   - Cleaning up after the game exits
//   - Pushing lobby/voice state to the DLL
//   - Forwarding user actions (mute, copyIp, chat) to the renderer

const net  = require('net')
const fs   = require('fs')
const path = require('path')
const { app } = require('electron')

const PIPE_NAME   = '\\\\.\\pipe\\gamenet-overlay'
const DLL_FNAME   = 'version.dll'
const BAK_SUFFIX  = '.gamenetbak'   // backup of a game's own version.dll
const POLL_MS     = 3000   // game-exit polling interval

// ── Feature flag ──────────────────────────────────────────────────────
// The native in-game overlay (version.dll injection) is DISABLED for now.
// While disabled, no DLL is ever copied into a game folder, and isActive()
// stays false so toggleOverlayPanel() falls back to the desktop BrowserWindow
// overlay (Ctrl+~) exactly as before. Flip back to true to resume work on it.
const NATIVE_OVERLAY_ENABLED = false

// Root of the shipped overlay DLLs. In a packaged app, vendor/ is copied via
// electron-builder `extraResources` to <resources>/vendor — it is NOT inside
// the asar, so __dirname-relative paths don't resolve there.
function _dllRootDir() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'vendor', 'overlay')
        : path.join(__dirname, '..', 'vendor', 'overlay')
}

// Read a PE file's Machine field → 'x86' | 'x64' | null
function _detectExeArch(exePath) {
    let fd
    try {
        fd = fs.openSync(exePath, 'r')
        const dos = Buffer.alloc(0x40)
        if (fs.readSync(fd, dos, 0, 0x40, 0) < 0x40)  return null
        if (dos.readUInt16LE(0) !== 0x5a4d)           return null // 'MZ'
        const peOff = dos.readUInt32LE(0x3c)
        const head  = Buffer.alloc(6)
        if (fs.readSync(fd, head, 0, 6, peOff) < 6)   return null
        if (head.readUInt32LE(0) !== 0x00004550)      return null // 'PE\0\0'
        const machine = head.readUInt16LE(4)
        if (machine === 0x8664) return 'x64'
        if (machine === 0x014c) return 'x86'
        return null
    } catch {
        return null
    } finally {
        if (fd !== undefined) { try { fs.closeSync(fd) } catch {} }
    }
}

// Byte-compare two files (used to recognise our own leftover version.dll so we
// don't mistake it for the game's original and "back it up").
function _filesEqual(a, b) {
    try {
        const sa = fs.statSync(a), sb = fs.statSync(b)
        if (sa.size !== sb.size) return false
        return fs.readFileSync(a).equals(fs.readFileSync(b))
    } catch {
        return false
    }
}

let _server       = null
let _client       = null   // current connected DLL socket
let _lineBuffer   = ''
let _mainWindow   = null
let _gameDir      = null   // directory where we placed the DLL
let _gameExeName  = null
let _pollTimer    = null
let _lastState    = null   // last pushed state (re-sent on reconnect)

// ── Setup (called once from main.js after mainWindow is created) ──────

function setup(mainWindow) {
    _mainWindow = mainWindow
    if (!NATIVE_OVERLAY_ENABLED) return
    _startPipeServer()
}

// ── Pipe server ───────────────────────────────────────────────────────

function _startPipeServer() {
    if (_server) return

    _server = net.createServer((socket) => {
        _client = socket
        _lineBuffer = ''
        console.log('[overlay-native] DLL connected')

        // Re-send the last known state so the DLL is up-to-date immediately
        if (_lastState) _pushJson(_lastState)

        socket.on('data', (chunk) => {
            _lineBuffer += chunk.toString('utf8')
            let pos
            while ((pos = _lineBuffer.indexOf('\n')) !== -1) {
                const line = _lineBuffer.slice(0, pos).trim()
                _lineBuffer = _lineBuffer.slice(pos + 1)
                if (line) _handleAction(line)
            }
        })

        socket.on('close', () => {
            if (_client === socket) _client = null
            console.log('[overlay-native] DLL disconnected')
        })

        socket.on('error', (err) => {
            console.log('[overlay-native] socket error:', err.message)
        })
    })

    _server.on('error', (err) => {
        console.log('[overlay-native] pipe server error:', err.message)
    })

    _server.listen(PIPE_NAME, () => {
        console.log('[overlay-native] pipe server listening')
    })
}

// ── Action handler (DLL → Electron) ──────────────────────────────────

function _handleAction(line) {
    try {
        const msg = JSON.parse(line)
        switch (msg.type) {
            case 'mute':
                _mainWindow?.webContents.send('overlay:action', { type: 'mute', userId: msg.userId })
                break
            case 'copyIp':
                _mainWindow?.webContents.send('overlay:action', { type: 'copyIp', userId: msg.userId, ip: msg.ip })
                break
            case 'chat':
                _mainWindow?.webContents.send('overlay:action', { type: 'chat', message: msg.message })
                break
        }
    } catch {
        // ignore malformed
    }
}

// ── Push state to DLL (Electron → DLL) ───────────────────────────────

function pushState(state) {
    const msg = { type: 'state', ...state }
    _lastState = msg
    _pushJson(msg)
}

function toggle() {
    _pushJson({ type: 'toggle' })
}

function show() {
    _pushJson({ type: 'show' })
}

function hide() {
    _pushJson({ type: 'hide' })
}

function _pushJson(obj) {
    if (!_client || _client.destroyed) return
    try {
        _client.write(JSON.stringify(obj) + '\n', 'utf8')
    } catch (e) {
        console.log('[overlay-native] write error:', e.message)
    }
}

// ── DLL deployment ────────────────────────────────────────────────────

function deployDll(gameExePath) {
    if (!NATIVE_OVERLAY_ENABLED) {
        console.log('[overlay-native] native overlay disabled — not deploying version.dll')
        return false
    }
    // Pick the DLL that matches the game's architecture (32-bit games can't
    // load a 64-bit DLL and vice-versa).
    const arch = _detectExeArch(gameExePath)
    if (!arch) {
        console.log('[overlay-native] could not determine game architecture — skipping deploy')
        return false
    }

    const src = path.join(_dllRootDir(), arch, DLL_FNAME)
    if (!fs.existsSync(src)) {
        console.log(`[overlay-native] ${arch}/version.dll not built/shipped — skipping deploy`)
        return false
    }

    const gameDir = path.dirname(gameExePath)
    const dst     = path.join(gameDir, DLL_FNAME)
    const bak     = dst + BAK_SUFFIX

    try {
        // A backup that is byte-identical to our DLL is a poisoned leftover from
        // a previous failed cleanup, not the game's real version.dll — drop it.
        if (fs.existsSync(bak) && _filesEqual(bak, src)) {
            fs.unlinkSync(bak)
        }
        // If the game ships its own version.dll, preserve it so we can restore
        // it on cleanup (don't overwrite an existing backup from a prior run).
        // But never back up our OWN leftover DLL — that would lose the real one
        // and make cleanup "restore" our DLL forever.
        if (fs.existsSync(dst) && !fs.existsSync(bak) && !_filesEqual(dst, src)) {
            fs.renameSync(dst, bak)
        }
        fs.copyFileSync(src, dst)
        _gameDir     = gameDir
        _gameExeName = path.basename(gameExePath)
        console.log(`[overlay-native] deployed ${arch} version.dll to`, gameDir)
        return true
    } catch (e) {
        console.log('[overlay-native] deploy failed:', e.message)
        return false
    }
}

// Returns true once the DLL is removed (and any backup restored). Returns false
// if version.dll is still loaded/locked (EPERM/EBUSY) — meaning a game process
// still holds it, so the caller should retry later instead of giving up.
function cleanupDll(onDone) {
    if (!_gameDir) { onDone && onDone(true); return }
    const dst = path.join(_gameDir, DLL_FNAME)
    const bak = dst + BAK_SUFFIX
    try {
        if (fs.existsSync(dst)) fs.unlinkSync(dst)   // throws EPERM if still loaded
        // Restore the game's own version.dll if we backed one up
        if (fs.existsSync(bak)) fs.renameSync(bak, dst)
        console.log('[overlay-native] removed version.dll from', _gameDir)
        _gameDir     = null
        _gameExeName = null
        _lastState   = null
        if (_client) { try { _client.destroy() } catch {} }
        onDone && onDone(true)
    } catch (e) {
        // DLL still mapped by a (child) game process — keep it in place.
        console.log('[overlay-native] cleanup deferred (version.dll still loaded):', e.message)
        onDone && onDone(false)
    }
}

// ── Game-exit watcher ─────────────────────────────────────────────────
// Polls tasklist; when the game process is gone, cleans up the DLL.

function watchGameExit(exeName) {
    if (!NATIVE_OVERLAY_ENABLED) return
    if (_pollTimer) clearInterval(_pollTimer)
    const { execFile } = require('child_process')
    let cleaning = false

    _pollTimer = setInterval(() => {
        execFile('tasklist', ['/FI', `IMAGENAME eq ${exeName}`, '/NH'],
            { windowsHide: true }, (err, stdout) => {
                const running = !err && stdout.toLowerCase().includes(exeName.toLowerCase())
                if (running || cleaning) return

                // The launched exe is gone — but many games use a launcher that
                // spawns the real game under a different process name. If that
                // child loaded our version.dll, the file stays locked and
                // cleanup fails; we treat that as "game still running" and keep
                // polling. Only when the DLL actually unlocks do we finish.
                cleaning = true
                cleanupDll((removed) => {
                    cleaning = false
                    if (removed) {
                        clearInterval(_pollTimer)
                        _pollTimer = null
                        console.log('[overlay-native] game exited, cleaned up')
                        _mainWindow?.webContents.send('overlay:game-exited', { exeName })
                    }
                })
            })
    }, POLL_MS)
}

// ── Public state ──────────────────────────────────────────────────────

function isActive() {
    if (!NATIVE_OVERLAY_ENABLED) return false
    return _gameDir !== null
}

// ── Called from main.js when app quits ───────────────────────────────

function destroy() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
    cleanupDll()
    if (_server) { _server.close(); _server = null }
}

module.exports = { setup, deployDll, cleanupDll, watchGameExit, pushState, toggle, show, hide, isActive, destroy }
