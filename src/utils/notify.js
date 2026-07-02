import { useNotificationStore } from '../store/notificationStore'
import { sounds } from './sound'

/**
 * نوتیف یکپارچه:
 * - همیشه in-app toast (اگه پنجره باز و focus)
 * - اگه پنجره minimize/background → native Windows notification
 */
export async function notify({ title, body, type = 'info', sound = null, toastDuration = 4000 }) {
    // صدا
    if (sound && sounds[sound]) sounds[sound]()

    // چک focus
    let focused = true
    try {
        focused = await window.electron?.window.isFocused()
    } catch {}

    if (focused) {
        // in-app toast
        useNotificationStore.getState().toast(body, type, toastDuration)
    } else {
        // native windows notification
        try {
            await window.electron?.notify.native({ title, body })
        } catch {
            // fallback به in-app
            useNotificationStore.getState().toast(body, type, toastDuration)
        }
    }
}