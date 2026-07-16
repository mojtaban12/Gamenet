import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useSetupStore } from '../store/setupStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { runSetup } from '../lib/setupRunner'

export default function SetupRunner() {
    const token = useAuthStore(s => s.token)
    const needsReregister = useNetbirdStore(s => s.needsReregister)
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

    // نت‌برد بعد از چند شکست پیاپی reconnect فهمید پیر/گروه روی سرور دیگه معتبر
    // نیست (مثلاً سرویس نت‌برد ریست شده) — کل فرآیند ثبت (setup key جدید + login
    // + register peer) رو دوباره از صفر اجرا کن.
    useEffect(() => {
        if (!needsReregister) return
        useNetbirdStore.getState().clearNeedsReregister()
        runSetup()
    }, [needsReregister])

    return null
}