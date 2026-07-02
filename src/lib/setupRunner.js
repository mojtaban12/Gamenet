import { useSetupStore, PHASE } from '../store/setupStore'
import { useAuthStore } from '../store/authStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { netbirdAPI } from '../api'

let running = false

export async function runSetup() {
    if (running) return
    running = true

    const { setPhase, setError, setDone, addLog, reset } = useSetupStore.getState()
    const { user, updateUser } = useAuthStore.getState()
    const { setStatus } = useNetbirdStore.getState()

    reset()

    try {
        if (!window.electron) {
            addLog('حالت توسعه — بدون Electron', 'info')
            setDone()
            running = false
            return
        }

        // ── Step 1: بررسی نصب بودن NetBird ─────────────────────────
        setPhase(PHASE.CHECKING)
        addLog('بررسی ماژول شبکه...')
        const installed = await window.electron.netbird.isInstalled()
        let justInstalled = false

        if (!installed) {
            setPhase(PHASE.INSTALLING)
            if (user?.netbirdPeerId) {
                addLog('ماژول شبکه حذف شده — نصب مجدد...')
            } else {
                addLog('در حال نصب ماژول شبکه...')
            }
            const installRes = await window.electron.netbird.install()
            if (!installRes.success) throw new Error(installRes.error || 'خطا در نصب')
            addLog('نصب با موفقیت انجام شد ✓', 'success')
            justInstalled = true
            if (user?.netbirdPeerId) {
                updateUser({ ...user, netbirdPeerId: null })
            }
        } else {
            addLog('ماژول شبکه آماده است ✓', 'success')
        }

        // ── Step 2: اگه قبلاً متصل بوده سعی کن reconnect کن ────────
        let reconnectFailed = false
        if (user?.netbirdPeerId && !justInstalled) {
            addLog('بررسی وضعیت اتصال...')
            const status = await window.electron.netbird.status()

            if (status.connected && status.ip) {
                addLog('متصل هستید ✓', 'success')
                setStatus(status)
                setDone()
                running = false
                return
            }

            setPhase(PHASE.CONNECTING)
            addLog('در حال reconnect...')
            const configRes = await netbirdAPI.getConfig()
            const managementUrl = configRes.data?.managementUrl
            if (managementUrl) {
                try {
                    await window.electron.netbird.connect({ managementUrl })
                    await new Promise(r => setTimeout(r, 4000))
                    const after = await window.electron.netbird.status()
                    if (after?.connected && after?.ip) {
                        addLog('متصل شدید ✓', 'success')
                        setStatus(after)
                        setDone()
                        running = false
                        return
                    }
                    reconnectFailed = true
                    addLog('نیاز به ثبت مجدد...', 'info')
                } catch {
                    reconnectFailed = true
                }
            }
        }

        // ── Step 3: دریافت Setup Key ─────────────────────────────────
        setPhase(PHASE.CONNECTING)
        addLog('دریافت کلید اتصال از سرور...')
        const keyRes = await netbirdAPI.getSetupKey()

        if (keyRes.data.alreadyRegistered && !reconnectFailed) {
            addLog('اتصال قبلی شناسایی شد ✓', 'success')
            const status = await window.electron.netbird.status()
            setStatus(status)
            setDone()
            running = false
            return
        }

        const { setupKey, managementUrl } = keyRes.data
        if (!managementUrl) throw new Error('ManagementUrl روی سرور تنظیم نشده')
        if (!setupKey) throw new Error('Setup Key دریافت نشد')

        addLog('اتصال به شبکه بازی...')
        const connectRes = await window.electron.netbird.connect({
            managementUrl,
            setupKey,
            hostname: user?.username || user?.email,
        })
        if (!connectRes.success) throw new Error(connectRes.error || 'اتصال به شبکه برقرار نشد — اینترنت یا تنظیمات فایروال خود را بررسی کنید')
        if (!connectRes.ip) throw new Error('IP از netbird دریافت نشد')

        addLog('متصل شدید ✓', 'success')
        setStatus(connectRes)

        // ── Step 4: ثبت Peer ID ──────────────────────────────────────
        setPhase(PHASE.REGISTERING)
        addLog('دریافت شناسه شبکه از سرور...')
        let peerId = null
        for (let i = 0; i < 5; i++) {
            try {
                const peerRes = await netbirdAPI.getPeerByIp(connectRes.ip)
                peerId = peerRes.data?.id
                if (peerId) break
            } catch {
                addLog(`تلاش ${i + 1}/5 برای دریافت شناسه...`)
                await new Promise(r => setTimeout(r, 2000))
            }
        }
        if (!peerId) throw new Error('شناسه شبکه از سرور دریافت نشد')

        await netbirdAPI.registerPeer(peerId)
        updateUser({ ...useAuthStore.getState().user, netbirdPeerId: peerId })
        addLog('هویت شبکه با موفقیت ثبت شد ✓', 'success')
        setDone()

    } catch (err) {
        const msg = err.response?.data?.message || err.message || 'خطای ناشناخته'
        setError(msg)
        addLog(`خطا: ${msg}`, 'error')
    } finally {
        // اتصال که برقرار شد (از هر مسیری)، watchdog رو روشن کن تا بعد از
        // قطعی/تغییر اینترنت خودکار و با همون IP دوباره وصل بشه.
        if (useSetupStore.getState().phase === PHASE.DONE) {
            try { await window.electron?.netbird.watch() } catch {}
        }
        running = false
    }
}
