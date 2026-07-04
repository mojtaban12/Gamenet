import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import { useStreamStore } from '../store/streamStore'
import { useNotificationStore } from '../store/notificationStore'
import Icon from './ui/Icon'

/**
 * دکمه استریم — کنار دکمه بازی.
 * با کلیک، یه منوی کوچک: حالت دستی یا خودکار.
 * exeName: اسم exe بازی فعلی (برای Game Capture در حالت خودکار)
 */
export default function StreamButton({ exeName }) {
    const { t } = useTranslation()
    const { streaming, connecting, watchUrl, startStream, stopStream } = useStreamStore()
    const { toast } = useNotificationStore()
    const [showMenu, setShowMenu] = useState(false)

    async function go(mode) {
        setShowMenu(false)
        const res = await startStream({ mode, exeName })
        if (res.success) {
            toast(t('stream.started'), 'success')
        } else if (res.error === 'obs_websocket_disabled') {
            toast(t('stream.obsWebsocketDisabled'), 'error', 10000)
        } else if (res.error === 'obs_not_found') {
            toast(res.detail || t('stream.obsNotFound'), 'error', 8000)
        } else if (res.error === 'obs_launch_timeout') {
            toast(t('stream.obsLaunchTimeout'), 'error', 10000)
        } else if (res.error === 'obs_not_connected') {
            toast(t('stream.obsNotConnected'), 'error', 9000)
        } else {
            toast(res.error || t('stream.startError'), 'error', 6000)
        }
    }

    async function stop() {
        await stopStream()
        toast(t('stream.stopped'), 'info')
    }

    if (streaming) {
        return (
            <div className="mt-2 space-y-2">
                <button
                    type="button"
                    onClick={stop}
                    className="w-full py-2.5 text-xs rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2 no-drag">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {t('stream.stop')}
                </button>
                {watchUrl && (
                    <button
                        type="button"
                        onClick={() => window.electron?.openExternal(watchUrl)}
                        className="w-full py-1.5 text-[11px] text-og-muted hover:text-og-accent transition-colors no-drag truncate">
                        {watchUrl}
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="mt-2 relative">
            <button
                type="button"
                disabled={connecting}
                onClick={() => setShowMenu(v => !v)}
                className="w-full py-2.5 text-xs rounded-lg border border-og hover:bg-og-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40 no-drag">
                {connecting ? (
                    <>
                        <span className="w-3.5 h-3.5 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin" />
                        {t('common.connecting')}
                    </>
                ) : (
                    <>
                        <Icon icon={Radio} size={14} />
                        {t('stream.stream')}
                    </>
                )}
            </button>

            {showMenu && (
                <div className="absolute bottom-full mb-1 inset-x-0 rounded-lg overflow-hidden z-50 shadow-2xl border border-og"
                     style={{ backgroundColor: '#14161ce5' }}>
                    <button
                        type="button"
                        onClick={() => go('auto')}
                        className="w-full px-3 py-2.5 text-xs text-start hover:bg-og-hover transition-colors text-og-body">
                        {t('stream.autoTitle')}
                        <span className="block text-[10px] text-og-muted mt-0.5">{t('stream.autoSubtitle')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => go('manual')}
                        className="w-full px-3 py-2.5 text-xs text-start hover:bg-og-hover transition-colors text-og-body border-t border-og">
                        {t('stream.manualTitle')}
                        <span className="block text-[10px] text-og-muted mt-0.5">{t('stream.manualSubtitle')}</span>
                    </button>
                </div>
            )}
        </div>
    )
}
