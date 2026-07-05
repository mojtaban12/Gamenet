import { create } from 'zustand'
import { settingAPI } from '../api'

export const SETTING_DEFAULTS = {
    'hotkey.voice.mute':     'Ctrl+U',
    'hotkey.voice.ptt':      'U',
    'hotkey.overlay.toggle': 'Ctrl+`',
    'hotkey.tinc.reset':     'Ctrl+1',
}

export const ADMIN_DEFAULTS = {
    'app.enabled':          'true',
    'stream.enabled':       'true',
    'lobby.voice.enabled':  'true',
    'lobby.teams.enabled':  'true',
    'lobby.chat.enabled':   'true',
    'friends.chat.enabled': 'true',
}

// ── Hotkey encoding ────────────────────────────────────────────────────────
// Hotkeys are stored as a canonical, human-readable token built from the
// PHYSICAL key (KeyboardEvent.code), never from e.key. e.code is NumLock- and
// layout-independent, so numpad keys stay distinct from the top-row digits
// (Numpad7 → "Num7" vs Digit7 → "7"). Using e.key broke numpad hotkeys because
// numpad 7 reports e.key "7" (NumLock on) or "Home" (NumLock off), which is
// both ambiguous and impossible to turn into the "num7" Electron accelerator.

// KeyboardEvent.code → canonical stored token (used by the recorder).
export function codeToToken(code) {
    if (code === 'Backquote') return '`'
    let m
    if ((m = /^Key([A-Z])$/.exec(code)))    return m[1]           // KeyU    → U
    if ((m = /^Digit([0-9])$/.exec(code)))  return m[1]           // Digit7  → 7
    if ((m = /^Numpad([0-9])$/.exec(code))) return `Num${m[1]}`   // Numpad7 → Num7
    switch (code) {
        case 'NumpadAdd':      return 'NumAdd'
        case 'NumpadSubtract': return 'NumSubtract'
        case 'NumpadMultiply': return 'NumMultiply'
        case 'NumpadDivide':   return 'NumDivide'
        case 'NumpadDecimal':  return 'NumDecimal'
        case 'NumpadEnter':    return 'NumEnter'
    }
    return code   // F7, ArrowUp, Space, Insert, …
}

// canonical token → KeyboardEvent.code (used for DOM matching)
function tokenToCode(keyPart) {
    if (keyPart === '`' || keyPart === '~') return 'Backquote'
    let m
    if ((m = /^Num([0-9])$/.exec(keyPart))) return `Numpad${m[1]}`
    switch (keyPart) {
        case 'NumAdd':      return 'NumpadAdd'
        case 'NumSubtract': return 'NumpadSubtract'
        case 'NumMultiply': return 'NumpadMultiply'
        case 'NumDivide':   return 'NumpadDivide'
        case 'NumDecimal':  return 'NumpadDecimal'
        case 'NumEnter':    return 'NumpadEnter'
    }
    if (/^[0-9]$/.test(keyPart))  return `Digit${keyPart}`
    if (keyPart.length === 1)     return `Key${keyPart.toUpperCase()}`
    return keyPart   // F7, ArrowUp, …
}

// canonical token → Electron accelerator key
function tokenToAccel(keyPart) {
    if (keyPart === '`' || keyPart === '~') return '`'
    let m
    if ((m = /^Num([0-9])$/.exec(keyPart))) return `num${m[1]}`
    switch (keyPart) {
        case 'NumAdd':      return 'numadd'
        case 'NumSubtract': return 'numsub'
        case 'NumMultiply': return 'nummult'
        case 'NumDivide':   return 'numdiv'
        case 'NumDecimal':  return 'numdec'
        case 'NumEnter':    return 'Enter'   // Electron has no distinct numpad-enter
    }
    return keyPart   // letters, digits, F-keys, ArrowUp, …
}

// "Ctrl+U"    → { code:'KeyU',    ctrl:true, shift:false, alt:false, label:'Ctrl+U' }
// "`"         → { code:'Backquote', ... }
// "Ctrl+Num7" → { code:'Numpad7', ctrl:true, ... }
export function parseHotkey(str) {
    str = str ?? 'U'
    const ctrl  = /ctrl\+/i.test(str)
    const shift = /shift\+/i.test(str)
    const alt   = /alt\+/i.test(str)
    const keyPart = str.split('+').at(-1)
    return { code: tokenToCode(keyPart), ctrl, shift, alt, label: str }
}

// "Ctrl+U" → "Control+U", "Ctrl+Num7" → "Control+num7"  (Electron accelerator format)
export function toElectronAccel(str) {
    if (!str) return ''
    const parts   = str.split('+')
    const keyPart = parts.pop()
    const mods = parts.map(p => {
        const l = p.toLowerCase()
        if (l === 'ctrl')  return 'Control'
        if (l === 'shift') return 'Shift'
        if (l === 'alt')   return 'Alt'
        return p
    })
    return [...mods, tokenToAccel(keyPart)].join('+')
}

export const useSettingStore = create((set, get) => ({
    settings:      { ...SETTING_DEFAULTS },
    adminSettings: { ...ADMIN_DEFAULTS },
    loaded:        false,

    async load() {
        try {
            const [userRes, adminRes] = await Promise.all([
                settingAPI.getAll(),
                settingAPI.getAdmin(),
            ])
            const merged = { ...SETTING_DEFAULTS }
            for (const { key, value } of userRes.data) merged[key] = value

            const adminMerged = { ...ADMIN_DEFAULTS }
            for (const { key, value } of adminRes.data) adminMerged[key] = value

            set({ settings: merged, adminSettings: adminMerged, loaded: true })
            get()._syncShortcuts(merged)
        } catch {
            set({ loaded: true })
        }
    },

    async update(key, value) {
        await settingAPI.update(key, value)
        const settings = { ...get().settings, [key]: value }
        set({ settings })
        get()._syncShortcuts(settings)
    },

    _syncShortcuts(s) {
        const el = window.electron
        if (!el?.shortcut?.set) return
        el.shortcut.set('voiceMuteToggle', toElectronAccel(s['hotkey.voice.mute']     ?? SETTING_DEFAULTS['hotkey.voice.mute']))
        el.shortcut.set('toggleOverlay',   toElectronAccel(s['hotkey.overlay.toggle'] ?? SETTING_DEFAULTS['hotkey.overlay.toggle']))
        el.shortcut.set('tincReset',       toElectronAccel(s['hotkey.tinc.reset']     ?? SETTING_DEFAULTS['hotkey.tinc.reset']))
    },
}))
