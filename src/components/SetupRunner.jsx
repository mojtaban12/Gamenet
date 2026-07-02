import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useSetupStore } from '../store/setupStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { runSetup } from '../lib/setupRunner'

export default function SetupRunner() {
    const token = useAuthStore(s => s.token)
    const startedRef = useRef(false)

    useEffect(() => {
        if (!token) {
            startedRef.current = false
            useSetupStore.getState().reset()
            return
        }
        if (startedRef.current) return
        startedRef.current = true
        runSetup()
    }, [token])

    // رویدادهای watchdog اتصال نت‌برد (قطع/در حال reconnect/وصل مجدد) رو به store برسون
    useEffect(() => {
        window.electron?.netbird.onStatus?.(status => {
            useNetbirdStore.getState().applyWatchStatus(status)
        })
    }, [])

    return null
}
