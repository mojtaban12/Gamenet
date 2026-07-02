import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { netbirdAPI } from '../api'
import { useNetbirdStore } from '../store/netbirdStore'
import { useAuthStore } from '../store/authStore'
import Icon from '../components/ui/Icon'

const STEPS = {
    CHECK:    0,
    INSTALL:  1,
    CONNECT:  2,
    REGISTER: 3,
    DONE:     4,
}

const STEP_LABELS = ['بررسی سیستم', 'نصب ماژول', 'اتصال شبکه', 'ثبت هویت', 'آماده']

export default function SetupPage() {
    const [step, setStep]   = useState(STEPS.CHECK)
    const [logs, setLogs]   = useState([])
    const [error, setError] = useState('')
    const logIdRef          = useRef(0)
    const logContainerRef   = useRef(null)
    const ranRef            = useRef(false)
    const navigate          = useNavigate()
    const { setStatus }     = useNetbirdStore()
    const { user, updateUser } = useAuthStore()

    const addLog = (msg, type = 'info') => {
        const id = ++logIdRef.current
        setLogs(l => [...l, { id, msg, type }])
    }

    useEffect(() => {
        if (ranRef.current) return
        ranRef.current = true
        runSetup()
    }, [])

    useEffect(() => {
        const el = logContainerRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [logs])

    async function runSetup() {
        setError('')
        setLogs([])

        try {
            // ── اگه electron نیست (browser dev) ───────────────────────
            if (!window.electron) {
                addLog('حالت توسعه — بدون Electron', 'info')
                setTimeout(() => navigate('/home'), 1500)
                return
            }

            // ── Step 1: چک نصب بودن NetBird ─────────────────────────
            setStep(STEPS.CHECK)
            addLog('بررسی ماژول شبکه...')
            const installed = await window.electron.netbird.isInstalled()
            let justInstalled = false

            if (!installed) {
                // NetBird نصب نیست — صرف نظر از peerId، باید نصب کنیم
                if (user?.netbirdPeerId) {
                    addLog('ماژول شبکه حذف شده — نصب مجدد...')
                } else {
                    addLog('در حال نصب ماژول شبکه...')
                }
                setStep(STEPS.INSTALL)
                const installRes = await window.electron.netbird.install()
                if (!installRes.success) throw new Error(installRes.error || 'خطا در نصب')
                addLog('نصب با موفقیت انجام شد ✓', 'success')
                justInstalled = true

                // اگه قبلاً peerId داشت، باید reset بشه چون peer جدیده
                if (user?.netbirdPeerId) {
                    addLog('ثبت مجدد هویت شبکه لازم است...')
                    updateUser({ ...user, netbirdPeerId: null })
                }
            } else {
                addLog('ماژول شبکه آماده است ✓', 'success')
            }

            // ── Step 2: فقط اگه نت‌برد از قبل نصب بوده (نه تازه‌نصب) reconnect کن ──
            // تازه‌نصب یعنی این سیستم profile/credential این کاربر رو نداره،
            // پس reconnect بدون key معنی نداره و SSO باز می‌کنه → مستقیم برو key+hostname
            let reconnectFailed = false
            if (user?.netbirdPeerId && !justInstalled) {
                addLog('بررسی وضعیت اتصال...')
                const status = await window.electron.netbird.status()

                if (status.connected && status.ip) {
                    addLog('متصل هستید ✓', 'success')
                    setStatus(status)
                    setTimeout(() => navigate('/home'), 1000)
                    return
                }

                // disconnect شده — تلاش برای reconnect بدون setup key
                setStep(STEPS.CONNECT)
                addLog('در حال reconnect...')

                const configRes = await netbirdAPI.getConfig()
                const managementUrl = configRes.data?.managementUrl
                if (!managementUrl) throw new Error('ManagementUrl تنظیم نشده')

                try {
                    await window.electron.netbird.connect({ managementUrl })
                    // مهم: up بدون key ممکنه «موفق» برگرده ولی واقعاً auth نشده باشه
                    // (peer روی سرور پاک شده). پس وضعیت واقعی رو چک کن.
                    await new Promise(r => setTimeout(r, 4000))
                    const after = await window.electron.netbird.status()
                    if (after?.connected && after?.ip) {
                        addLog('متصل شدید ✓', 'success')
                        setStatus(after)
                        setStep(STEPS.DONE)
                        setTimeout(() => navigate('/home'), 1000)
                        return
                    }
                    // وصل نشد → نیاز به ثبت مجدد با setup-key
                    reconnectFailed = true
                    addLog('اتصال قبلی معتبر نیست — ثبت مجدد با کلید...', 'info')
                } catch {
                    reconnectFailed = true
                    addLog('reconnect ناموفق — ثبت مجدد با کلید...', 'info')
                }
            }

            // ── Step 3: گرفتن Setup Key ───────────────────────────────
            setStep(STEPS.CONNECT)
            addLog('دریافت کلید اتصال از سرور...')

            const keyRes = await netbirdAPI.getSetupKey()

            // اگه peer واقعاً روی سرور هست و reconnect هم لازم نبوده
            if (keyRes.data.alreadyRegistered && !reconnectFailed) {
                addLog('اتصال قبلی شناسایی شد ✓', 'success')
                const status = await window.electron.netbird.status()
                setStatus(status)
                setTimeout(() => navigate('/home'), 1200)
                return
            }

            const { setupKey, managementUrl } = keyRes.data

            if (!managementUrl) throw new Error('ManagementUrl روی سرور تنظیم نشده')
            if (!setupKey) throw new Error('Setup Key دریافت نشد')

            addLog(`کلید اتصال دریافت شد`)
            addLog(`اتصال به ${managementUrl} ...`)

            // ── Step 4: اجرای netbird up ──────────────────────────────
            const connectRes = await window.electron.netbird.connect({ managementUrl, setupKey, hostname: user?.username || user?.email })

            if (!connectRes.success) throw new Error(connectRes.error || 'اتصال به شبکه برقرار نشد — اینترنت یا تنظیمات فایروال خود را بررسی کنید')
            if (!connectRes.ip) throw new Error('IP از netbird دریافت نشد')

            addLog('متصل شدید ✓', 'success')
            setStatus(connectRes)

            // ── Step 5: پیدا کردن Peer ID از سرور با IP ──────────────
            setStep(STEPS.REGISTER)
            addLog('دریافت شناسه شبکه از سرور...')

            // چند بار تلاش می‌کنیم چون گاهی سرور NetBird کمی تاخیر داره
            let peerId = null
            for (let i = 0; i < 5; i++) {
                try {
                    const peerRes = await netbirdAPI.getPeerByIp(connectRes.ip)
                    peerId = peerRes.data?.id
                    if (peerId) break
                } catch {
                    addLog(`تلاش ${i + 1}/5 برای دریافت شناسه...`)
                    await sleep(2000)
                }
            }

            if (!peerId) throw new Error('شناسه شبکه از سرور دریافت نشد')

            addLog(`شناسه دریافت شد: ${peerId.substring(0, 8)}...`)

            // ── Step 6: ثبت Peer ID روی اکانت کاربر ─────────────────
            await netbirdAPI.registerPeer(peerId)
            updateUser({ ...user, netbirdPeerId: peerId })

            addLog('هویت شبکه با موفقیت ثبت شد ✓', 'success')
            setStep(STEPS.DONE)
            addLog('آماده بازی هستید!', 'success')

            setTimeout(() => navigate('/home'), 1500)

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'خطای ناشناخته'
            setError(msg)
            addLog(`خطا: ${msg}`, 'error')
        }
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms))

    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md animate-slide-up">
                <h2 className="font-display font-bold text-2xl text-gn-text mb-1">
                    راه‌اندازی اولیه
                </h2>
                <p className="text-gn-muted text-sm mb-8">اتصال به شبکه بازی...</p>

                {/* Progress steps */}
                <div className="flex items-center mb-8">
                    {STEP_LABELS.slice(0, -1).map((label, i) => (
                        <div key={i} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-500
                  ${i < step  ? 'bg-gn-green text-gn-bg' :
                                    i === step ? 'bg-gn-accent text-gn-bg animate-pulse' :
                                        'bg-gn-border text-gn-muted'}`}>
                                    {i < step ? <Icon icon={Check} size="xs" /> : i + 1}
                                </div>
                                <span className={`text-xs whitespace-nowrap transition-colors duration-300
                  ${i === step ? 'text-gn-accent' : i < step ? 'text-gn-green' : 'text-gn-muted'}`}>
                  {label}
                </span>
                            </div>
                            {i < STEP_LABELS.length - 2 && (
                                <div className={`flex-1 h-px mx-2 mb-4 transition-all duration-500
                  ${i < step ? 'bg-gn-green' : 'bg-gn-border'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Log output */}
                <div
                    ref={logContainerRef}
                    className="bg-gn-surface border border-gn-border rounded-lg p-4 h-52 overflow-y-auto font-mono text-xs space-y-1.5"
                >
                    {logs.map(l => (
                        <div key={l.id} className={`flex gap-2 animate-fade-in
              ${l.type === 'error'   ? 'text-gn-red' :
                            l.type === 'success' ? 'text-gn-green' :
                                'text-gn-muted'}`}>
                            <span className="opacity-50 flex-shrink-0 select-none">›</span>
                            <span>{l.msg}</span>
                        </div>
                    ))}
                    {!error && step !== STEPS.DONE && (
                        <div className="text-gn-accent animate-pulse select-none">▊</div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                        <div className="p-3 rounded border border-gn-red/30 bg-gn-red/10 text-gn-red text-sm">
                            {error}
                        </div>
                        <button onClick={runSetup} className="gn-btn-ghost w-full">
                            تلاش مجدد
                        </button>
                    </div>
                )}

                {!error && step !== STEPS.DONE && (
                    <p className="text-center text-gn-muted text-xs mt-4 animate-pulse">
                        {STEP_LABELS[step]}...
                    </p>
                )}
            </div>
        </div>
    )
}