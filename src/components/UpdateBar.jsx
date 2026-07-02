import { useEffect } from 'react'
import { DownloadCloud, ArrowUpCircle, RotateCw } from 'lucide-react'
import { useUpdateStore } from '../store/updateStore'

export default function UpdateBar() {
    const { phase, progress } = useUpdateStore()

    useEffect(() => {
        if (phase === 'ready') {
            window.electron?.update?.install()
        }
    }, [phase])

    // Only show for force updates pushed mid-session via SignalR
    if (phase === 'idle' || phase === 'available' || phase === 'checking') return null

    if (phase === 'force') {
        return (
            <div className="rounded-xl p-3 mb-3" style={{
                background: 'rgba(0,218,243,0.06)',
                border: '1px solid rgba(0,218,243,0.15)',
            }}>
                <div className="flex items-center gap-2">
                    <ArrowUpCircle size={13} className="shrink-0" style={{ color: 'var(--og-primary)' }} />
                    <div className="text-xs font-semibold" style={{ color: 'var(--og-primary)' }}>
                        بررسی آپدیت جدید
                    </div>
                    <div className="mr-auto w-3 h-3 rounded-full border-2 border-transparent animate-spin"
                         style={{ borderTopColor: 'var(--og-primary)', borderRightColor: 'rgba(0,218,243,0.3)' }} />
                </div>
            </div>
        )
    }

    if (phase === 'downloading') {
        const pct = Math.round(progress?.percent ?? 0)
        return (
            <div className="rounded-xl p-3 mb-3" style={{
                background: 'rgba(0,218,243,0.06)',
                border: '1px solid rgba(0,218,243,0.15)',
            }}>
                <div className="flex items-center gap-2 mb-2">
                    <DownloadCloud size={13} className="shrink-0 animate-pulse" style={{ color: 'var(--og-primary)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--og-primary)' }}>
                        دانلود آپدیت اجباری
                    </span>
                    <span className="text-[10px] mr-auto" style={{ color: 'var(--og-muted)' }}>
                        {pct}%
                    </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden"
                     style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, var(--og-primary), #9cf0ff)',
                            boxShadow: '0 0 8px rgba(0,218,243,0.4)',
                        }}
                    />
                </div>
            </div>
        )
    }

    if (phase === 'ready') {
        return (
            <div className="rounded-xl p-3 mb-3" style={{
                background: 'rgba(0,218,243,0.06)',
                border: '1px solid rgba(0,218,243,0.15)',
            }}>
                <div className="flex items-center gap-2">
                    <RotateCw size={13} className="shrink-0 animate-spin" style={{ color: 'var(--og-primary)' }} />
                    <div className="text-xs font-semibold" style={{ color: 'var(--og-primary)' }}>
                        در حال نصب آپدیت...
                    </div>
                </div>
            </div>
        )
    }

    return null
}
