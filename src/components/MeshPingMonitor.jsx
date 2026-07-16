import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { usePingStore } from '../store/pingStore'
import { getMeshState } from '../store/lobbyStore'

const PING_INTERVAL_MS = 3000
const PING_WARN_AFTER_MS = 60000

function uid(id) {
    return id?.toString().toLowerCase() ?? ''
}

// پینگ زنده بین اعضای لابی — هر کلاینت مستقیم با IP مش هر عضو دیگه پینگ می‌گیره
// و وضعیتش رو توی pingStore ذخیره می‌کنه (برای نقطه‌ی سبز/زرد کنار هر عضو).
// اگر بیش از ۶۰ ثانیه پینگ برقرار نشه، یک بار به کاربر پیام می‌دیم که Ctrl+1 بزنه.
export default function MeshPingMonitor({ groupId, members, gameInfo }) {
    const { t } = useTranslation()
    const { toast } = useNotificationStore()
    const myUserId = useAuthStore(s => uid(s.user?.id))

    const membersRef = useRef(members)
    membersRef.current = members
    const gameTypeRef = useRef(gameInfo?.game?.gameType)
    gameTypeRef.current = gameInfo?.game?.gameType

    useEffect(() => {
        usePingStore.getState().clear()
    }, [groupId])

    useEffect(() => {
        if (!window.electron?.tinc?.ping) return
        let stopped = false
        let timer = null

        async function tick() {
            if (stopped) return
            const { resetting } = usePingStore.getState()
            const { meshActive } = getMeshState()
            const useTincIp = gameTypeRef.current !== 2
            const currentMembers = membersRef.current || []

            if (!resetting && meshActive) {
                for (const m of currentMembers) {
                    if (stopped) return
                    const id = uid(m.userId)
                    if (!id || id === myUserId) continue
                    const ip = useTincIp ? m.tincIp : m.ip
                    if (!ip) continue
                    try {
                        const res = await window.electron.tinc.ping(ip)
                        usePingStore.getState().setPing(id, !!res?.ok)
                    } catch {
                        usePingStore.getState().setPing(id, false)
                    }
                }
            }

            if (stopped) return
            const { status } = usePingStore.getState()
            const now = Date.now()
            for (const m of currentMembers) {
                const id = uid(m.userId)
                if (!id || id === myUserId) continue
                const s = status[id]
                if (s && !s.ok && !s.warned && s.failingSince && (now - s.failingSince) >= PING_WARN_AFTER_MS) {
                    usePingStore.getState().markWarned(id)
                    toast(t('lobby.pingTimeoutHint', { name: m.username || '' }), 'error', 8000)
                }
            }

            if (!stopped) timer = setTimeout(tick, PING_INTERVAL_MS)
        }

        timer = setTimeout(tick, 500)
        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
    }, [groupId, myUserId, toast, t])

    return null
}
