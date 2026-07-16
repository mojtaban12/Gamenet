import { tincAPI } from '../api'
import i18n from '../i18n'

// تبدیل ArrayBuffer به base64 (برای پاس دادن zip به electron)
function arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
}

export async function isTincRunning() {
    try {
        const st = await window.electron?.tinc?.status?.()
        return !!st?.running
    } catch {
        return false
    }
}

/**
 * شبکه L2 لابی — join mesh + اعمال config.
 * اگر tinc از قبل در حال اجراست فقط hosts را زنده به‌روز می‌کند (بدون kill/restart).
 */
export async function bringUpMesh(lobbyId, underlayIp, onProgress = () => {}) {
    onProgress('register', i18n.t('mesh.registering'))
    try {
        await tincAPI.register()
    } catch {}

    onProgress('join', i18n.t('mesh.joining'))
    const joinRes = await tincAPI.joinLobby(lobbyId, underlayIp)
    const version = joinRes.data?.version ?? 0
    const tincIp  = joinRes.data?.tincIp ?? null

    onProgress('config', i18n.t('mesh.gettingConfig'))
    const res = await tincAPI.getConfig(lobbyId)
    const zipB64 = arrayBufferToBase64(res.data)

    const running = await isTincRunning()
    onProgress('start', i18n.t('mesh.startingConnection'))
    const result = running
        ? await window.electron.tinc.updateConfig(zipB64)
        : await window.electron.tinc.applyConfig(zipB64)
    if (!result.success) throw new Error(result.error || i18n.t('mesh.setupError'))

    onProgress('done', i18n.t('mesh.ready'))
    return { version, tincIp }
}

/**
 * config جدید بگیر و «زنده» اعمال کن (وقتی کسی join/leave کرد) — بدون restart و
 * بدون قطع تونل. فقط فایل‌های host به‌روز می‌شن تا peer جدید بدون قطعِ اتصال‌های
 * موجود وارد مش بشه. تونل تا استارت بازیِ بعدی یا خروج از لابی فعال می‌مونه.
 */
export async function refreshMesh(lobbyId) {
    const res = await tincAPI.getConfig(lobbyId)
    const zipB64 = arrayBufferToBase64(res.data)
    await window.electron.tinc.updateConfig(zipB64)
}

/**
 * شبکه رو پایین بیار (خروج از لابی)
 */
export async function tearDownMesh(lobbyId) {
    try { await tincAPI.leaveLobby(lobbyId) } catch {}
    try { await window.electron.tinc.stop() } catch {}
}
