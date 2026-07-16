import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { usePingStore } from '../store/pingStore'
import { leaveLobby, getMeshState, useLobbyStore, recoverLobbyNetbird } from '../store/lobbyStore'
import { refreshMesh } from '../utils/meshNetwork'

export default function LobbySession() {
    const { t } = useTranslation()
    const token = useAuthStore(s => s.token)
    const { toast } = useNotificationStore()

    useEffect(() => {
        if (!token) leaveLobby()
    }, [token])

    useEffect(() => {
        if (!window.electron?.tinc?.onHardResetStart) return
        return window.electron.tinc.onHardResetStart(() => {
            usePingStore.getState().setResetting(true)
        })
    }, [])

    useEffect(() => {
        if (!window.electron?.tinc?.onHardResetDone) return
        return window.electron.tinc.onHardResetDone(async (result) => {
            usePingStore.getState().setResetting(false)
            if (!result?.success) {
                toast(t('tinc.resetFailed', { error: result?.error || '' }), 'error', 5000)
                return
            }
            if (!result.running && result.restarted) {
                toast(t('tinc.resetNotRunning'), 'error', 5000)
                return
            }
            const groupId = useLobbyStore.getState().activeLobby?.groupId
            const { meshActive } = getMeshState()
            if (groupId && meshActive) {
                try {
                    await refreshMesh(groupId)
                    toast(t('tinc.resetOkMesh'), 'success', 3000)
                } catch {
                    toast(t('tinc.resetOkNoMesh'), 'success', 3000)
                }
            } else {
                toast(t('tinc.resetOk'), 'success', 3000)
            }
        })
    }, [toast, t])

    // VPN recovered while still in lobby — re-join NetBird group (removed on SignalR drop).
    useEffect(() => {
        return useNetbirdStore.subscribe((state, prev) => {
            if (!prev.connected && state.connected && useLobbyStore.getState().activeLobby?.groupId) {
                recoverLobbyNetbird().catch(() => {})
            }
        })
    }, [])

    return null
}
