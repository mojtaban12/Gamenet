import { useSetupStore, PHASE } from '../store/setupStore'
import { useAuthStore } from '../store/authStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { netbirdAPI } from '../api'
import i18n from '../i18n'

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
            addLog(i18n.t('setup.devMode'), 'info')
            setDone()
            running = false
            return
        }

        // ── Step 1: بررسی نصب بودن NetBird ─────────────────────────
        setPhase(PHASE.CHECKING)
        addLog(i18n.t('setup.checkingModule'))
        const installed = await window.electron.netbird.isInstalled()
        let justInstalled = false

        if (!installed) {
            setPhase(PHASE.INSTALLING)
            if (user?.netbirdPeerId) {
                addLog(i18n.t('setup.moduleRemovedReinstall'))
            } else {
                addLog(i18n.t('setup.installingModule'))
            }
            const installRes = await window.electron.netbird.install()
            if (!installRes.success) throw new Error(installRes.error || i18n.t('setup.installError'))
            addLog(i18n.t('setup.installSuccess'), 'success')
            justInstalled = true
            if (user?.netbirdPeerId) {
                updateUser({ ...user, netbirdPeerId: null })
            }
        } else {
            addLog(i18n.t('setup.moduleReady'), 'success')
        }

        // ── Step 2: اگه قبلاً متصل بوده سعی کن reconnect کن ────────
        let reconnectFailed = false
        if (user?.netbirdPeerId && !justInstalled) {
            addLog(i18n.t('setup.checkingConnection'))
            const status = await window.electron.netbird.status()

            if (status.connected && status.ip) {
                addLog(i18n.t('setup.connected'), 'success')
                setStatus(status)
                setDone()
                running = false
                return
            }

            setPhase(PHASE.CONNECTING)
            addLog(i18n.t('setup.reconnecting'))
            const configRes = await netbirdAPI.getConfig()
            const managementUrl = configRes.data?.managementUrl
            if (managementUrl) {
                try {
                    await window.electron.netbird.connect({ managementUrl })
                    await new Promise(r => setTimeout(r, 4000))
                    const after = await window.electron.netbird.status()
                    if (after?.connected && after?.ip) {
                        addLog(i18n.t('setup.connectedExclaim'), 'success')
                        setStatus(after)
                        setDone()
                        running = false
                        return
                    }
                    reconnectFailed = true
                    addLog(i18n.t('setup.reregisterNeeded'), 'info')
                } catch {
                    reconnectFailed = true
                }
            }
        }

        // ── Step 3: دریافت Setup Key ─────────────────────────────────
        setPhase(PHASE.CONNECTING)
        addLog(i18n.t('setup.gettingKey'))
        const keyRes = await netbirdAPI.getSetupKey()

        if (keyRes.data.alreadyRegistered && !reconnectFailed) {
            addLog(i18n.t('setup.previousConnectionDetected'), 'success')
            const status = await window.electron.netbird.status()
            setStatus(status)
            setDone()
            running = false
            return
        }

        const { setupKey, managementUrl } = keyRes.data
        if (!managementUrl) throw new Error(i18n.t('setup.managementUrlServerMissing'))
        if (!setupKey) throw new Error(i18n.t('setup.setupKeyMissing'))

        addLog(i18n.t('setup.connectingToNetwork'))
        const connectRes = await window.electron.netbird.connect({
            managementUrl,
            setupKey,
            hostname: user?.username || user?.email,
        })
        if (!connectRes.success) throw new Error(connectRes.error || i18n.t('setup.connectFailed'))
        if (!connectRes.ip) throw new Error(i18n.t('setup.ipMissing'))

        addLog(i18n.t('setup.connectedExclaim'), 'success')
        setStatus(connectRes)

        // ── Step 4: ثبت Peer ID ──────────────────────────────────────
        setPhase(PHASE.REGISTERING)
        addLog(i18n.t('setup.gettingPeerId'))
        let peerId = null
        for (let i = 0; i < 5; i++) {
            try {
                const peerRes = await netbirdAPI.getPeerByIp(connectRes.ip)
                peerId = peerRes.data?.id
                if (peerId) break
            } catch {
                addLog(i18n.t('setup.retryAttempt', { attempt: i + 1 }))
                await new Promise(r => setTimeout(r, 2000))
            }
        }
        if (!peerId) throw new Error(i18n.t('setup.peerIdMissing'))

        await netbirdAPI.registerPeer(peerId)
        updateUser({ ...useAuthStore.getState().user, netbirdPeerId: peerId })
        addLog(i18n.t('setup.registeredSuccess'), 'success')
        setDone()

    } catch (err) {
        const msg = err.response?.data?.message || err.message || i18n.t('setup.unknownError')
        setError(msg)
        addLog(i18n.t('setup.errorPrefix', { message: msg }), 'error')
    } finally {
        // اتصال که برقرار شد (از هر مسیری)، watchdog رو روشن کن تا بعد از
        // قطعی/تغییر اینترنت خودکار و با همون IP دوباره وصل بشه.
        if (useSetupStore.getState().phase === PHASE.DONE) {
            try { await window.electron?.netbird.watch() } catch {}
        }
        running = false
    }
}
