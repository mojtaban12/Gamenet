import { useAuthStore } from '../store/authStore'
import { performFullLogout } from './logout'

function isOwnNewSession(data) {
    try {
        const myToken = useAuthStore.getState().token
        if (myToken && data?.newSessionId) {
            const payload = JSON.parse(atob(myToken.split('.')[1]))
            return payload.sid === data.newSessionId
        }
    } catch {}
    return false
}

/** سرور سشن را باطل کرده — همان پاک‌سازی دکمه خروج */
export function handleForceLogout(data) {
    if (isOwnNewSession(data)) return

    setTimeout(() => {
        if (isOwnNewSession(data)) return
        performFullLogout({
            skipServer: true,
            showNotify: true,
            reason: data?.reason,
        })
    }, 1500)
}
