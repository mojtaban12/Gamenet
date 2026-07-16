import { netbirdAPI } from '../api'
import { useAuthStore } from '../store/authStore'

/**
 * بعضی وقت‌ها روی سرور peerId کاربر پاک/گم می‌شه (مثلاً بعد از reregister نت‌برد)
 * ولی تونل محلی هنوز وصل و سالمه. در این حالت درخواست‌هایی مثل ساخت/پیوستن به
 * لابی با خطای «ابتدا باید Peer ثبت کنی» شکست می‌خورن. این تابع سعی می‌کند بدون
 * نمایش خطا به کاربر، peerId رو دوباره از روی IP فعلی بگیره و در دیتابیس ثبت کنه؛
 * اگه تونل محلی هم قطع بود، اول یک reconnect به نت‌برد می‌زنه.
 *
 * @returns {Promise<boolean>} true اگه peer با موفقیت (دوباره) ثبت شد
 */
export async function recoverPeerRegistration() {
    if (!window.electron?.netbird) return false

    try {
        let status = await window.electron.netbird.status()

        if (!status?.connected || !status?.ip) {
            try { await window.electron.netbird.reconnect() } catch {}
            status = await window.electron.netbird.status()
        }

        if (!status?.connected || !status?.ip) return false

        let peerId = null
        for (let i = 0; i < 3; i++) {
            try {
                const peerRes = await netbirdAPI.getPeerByIp(status.ip)
                peerId = peerRes.data?.id
                if (peerId) break
            } catch {
                await new Promise(r => setTimeout(r, 1500))
            }
        }
        if (!peerId) return false

        await netbirdAPI.registerPeer(peerId)

        const { user, updateUser } = useAuthStore.getState()
        updateUser({ ...user, netbirdPeerId: peerId })
        return true
    } catch {
        return false
    }
}

/** true اگه خطای سرور همون «ابتدا باید Peer ثبت کنی» باشه (peerId گم/نامعتبره) */
export function isMissingPeerError(err) {
    const msg = err?.response?.data?.message || ''
    return err?.response?.status === 400 && msg.includes('Peer ثبت')
}

/**
 * یک درخواست async رو اجرا می‌کند؛ اگه با خطای «peerId ثبت نشده» شکست خورد،
 * یک‌بار peer رو ری‌کاور می‌کند و درخواست رو دوباره اجرا می‌کند — همه بی‌صدا،
 * بدون نمایش خطای واسط به کاربر.
 */
export async function withPeerRecovery(fn) {
    try {
        return await fn()
    } catch (err) {
        if (!isMissingPeerError(err)) throw err
        const recovered = await recoverPeerRegistration()
        if (!recovered) throw err
        return await fn()
    }
}
