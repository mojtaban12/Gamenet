import { useState } from 'react'
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
    const { streaming, connecting, watchUrl, startStream, stopStream } = useStreamStore()
    const { toast } = useNotificationStore()
    const [showMenu, setShowMenu] = useState(false)

    async function go(mode) {
        setShowMenu(false)
        const res = await startStream({ mode, exeName })
        if (res.success) {
            toast('استریم شروع شد', 'success')
        } else if (res.error === 'obs_websocket_disabled') {
            toast('OBS باز است اما WebSocket فعال نیست. در Tools → WebSocket Server Settings آن را روشن کنید (پورت 4455، بدون رمز).', 'error', 10000)
        } else if (res.error === 'obs_not_found') {
            toast(res.detail || 'OBS Studio روی این دستگاه پیدا نشد. لطفاً آن را نصب کنید.', 'error', 8000)
        } else if (res.error === 'obs_launch_timeout') {
            toast('OBS اجرا شد اما WebSocket آماده نشد. مطمئن شوید WebSocket Server در Tools فعال است (پورت 4455، بدون رمز)، سپس دوباره امتحان کنید.', 'error', 10000)
        } else if (res.error === 'obs_not_connected') {
            toast('اتصال به OBS ناموفق. مطمئن شوید OBS باز است و در Tools → WebSocket Server Settings فعال است (پورت 4455، بدون رمز).', 'error', 9000)
        } else {
            toast(res.error || 'خطا در شروع استریم', 'error', 6000)
        }
    }

    async function stop() {
        await stopStream()
        toast('استریم متوقف شد', 'info')
    }

    if (streaming) {
        return (
            <div className="mt-2 space-y-2">
                <button
                    type="button"
                    onClick={stop}
                    className="w-full py-2.5 text-xs rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2 no-drag">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    توقف استریم
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
                        در حال اتصال...
                    </>
                ) : (
                    <>
                        <Icon icon={Radio} size={14} />
                        استریم
                    </>
                )}
            </button>

            {showMenu && (
                <div className="absolute bottom-full mb-1 inset-x-0 rounded-lg overflow-hidden z-50 shadow-2xl border border-og"
                     style={{ backgroundColor: '#14161ce5' }}>
                    <button
                        type="button"
                        onClick={() => go('auto')}
                        className="w-full px-3 py-2.5 text-xs text-right hover:bg-og-hover transition-colors text-og-body">
                        استریم خودکار بازی
                        <span className="block text-[10px] text-og-muted mt-0.5">صحنه خودکار ساخته می‌شود</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => go('manual')}
                        className="w-full px-3 py-2.5 text-xs text-right hover:bg-og-hover transition-colors text-og-body border-t border-og">
                        استریم با صحنه OBS خودم
                        <span className="block text-[10px] text-og-muted mt-0.5">از صحنه فعلی OBS استفاده می‌شود</span>
                    </button>
                </div>
            )}
        </div>
    )
}