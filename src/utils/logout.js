import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { notify } from './notify'

/**
 * Best-effort server-side session end when the app is simply closed/quit
 * (X → Quit App, tray "خروج", OS shutdown) — NOT a full logout. Unlike
 * performFullLogout, this does NOT uninstall the local NetBird service or
 * clear local storage; it only tells the server the session is over
 * (peer release, presence clear, ForceLogout broadcast) so the account is
 * not left "online" server-side until the idle/stale cleanup jobs catch it.
 * Never throws — safe to call without awaiting from a quit handler.
 */
export async function notifyServerLogoutOnQuit() {
    const { token, loggingOut } = useAuthStore.getState()
    if (!token || loggingOut) return

    try {
        const { authAPI } = await import('../api')
        await authAPI.logout()
    } catch {}
}

/**
 * Full sign-out — same path for manual logout (sidebar/X) and SignalR ForceLogout.
 * @param {object} opts
 * @param {boolean} opts.skipServer - true when server already ran EndSession (ForceLogout)
 * @param {boolean} opts.showNotify - show toast (idle / login elsewhere)
 * @param {string}  opts.reason - notification body
 */
export async function performFullLogout({ skipServer = false, showNotify = false, reason } = {}) {
    const state = useAuthStore.getState()
    if (state.loggingOut) return

    useAuthStore.setState({ loggingOut: true })

    try {
        const tokenAtStart = useAuthStore.getState().token

        if (showNotify && reason) {
            const i18n = (await import('../i18n')).default
            notify({
                title: i18n.t('presence.logoutTitle'),
                body: reason,
                type: 'info',
                sound: 'notify',
            })
        }

        try {
            const { leaveLobby } = await import('../store/lobbyStore')
            await leaveLobby()
        } catch {}

        try {
            const { useVoiceStore } = await import('../store/voiceStore')
            await useVoiceStore.getState().disconnect()
        } catch {}

        const token = tokenAtStart

        if (!skipServer && token) {
            try {
                const { authAPI } = await import('../api')
                await authAPI.logout()
            } catch {}
        }

        if (token) {
            try {
                const { netbirdAPI } = await import('../api')
                await netbirdAPI.releasePeer()
            } catch {}
        }

        try { await window.electron?.netbird.uninstall() } catch {}
        try { await window.electron?.auth.clear() } catch {}

        useAuthStore.setState({ token: null, user: null })
        useUiStore.getState().closeLogoutModal()
        useUiStore.getState().closeExitModal()
    } finally {
        useAuthStore.setState({ loggingOut: false })
    }
}
