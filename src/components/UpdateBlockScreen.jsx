import { useEffect, useState } from 'react'
import { RefreshCw, RotateCw, Minus, X } from 'lucide-react'
import appIcon from '../../assets/icon-32.png'
import { useUpdateStore } from '../store/updateStore'
import Icon from './ui/Icon'

export default function UpdateBlockScreen({ currentVersion, latestVersion }) {
    const { phase, progress, setDownloading, setProgress, setReady } = useUpdateStore()
    const [closing, setClosing] = useState(false)

    useEffect(() => {
        if (!window.electron?.update) return

        window.electron.update.onProgress(p      => setProgress({ percent: p.percent >= 0 ? p.percent : 0 }))
        window.electron.update.onDownloaded(()   => setReady())
        window.electron.update.onError?.(() => {})

        setDownloading()
        window.electron.update.download()
    }, [])

    // Listen for quit signal from tray menu (same loading treatment)
    useEffect(() => {
        window.electron?.window.onQuitting?.(() => setClosing(true))
    }, [])

    async function handleClose() {
        setClosing(true)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        window.electron?.window.quit()
    }

    // Relaunch as soon as download is ready
    useEffect(() => {
        if (phase === 'ready') {
            window.electron?.update?.install()
        }
    }, [phase])

    const pct  = Math.round(progress?.percent ?? 0)

    const statusText = {
        idle:        'در حال آماده‌سازی...',
        downloading: `در حال دانلود... ${pct}%`,
        ready:       'در حال نصب و راه‌اندازی مجدد...',
    }[phase] ?? 'در حال دانلود...'

    return (
        <div className="h-screen flex flex-col bg-gn-bg overflow-hidden">
            {closing && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-gn-bg/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-11 h-11 border-2 border-og-primary/30 border-t-gn-accent rounded-full animate-spin" />
                        <p className="text-gn-muted text-sm">در حال خروج...</p>
                    </div>
                </div>
            )}

            <div
                dir="ltr"
                className="drag-region h-10 bg-gn-surface border-b border-gn-border flex items-center justify-between px-4 select-none flex-shrink-0">
                <div className="flex items-center gap-3">
                    <img src={appIcon} alt="" className="w-5 h-5 object-contain shrink-0" draggable={false} />
                    <span className="font-display font-bold text-sm tracking-[0.2em] text-gn-accent uppercase">TARGAME</span>
                </div>
                <div className="no-drag flex items-center gap-1">
                    <button
                        onClick={() => window.electron?.window.minimize()}
                        disabled={closing}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors disabled:opacity-40">
                        <Icon icon={Minus} size={14} />
                    </button>
                    <button
                        onClick={handleClose}
                        disabled={closing}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/20 text-gn-muted hover:text-gn-red transition-colors disabled:opacity-40">
                        <Icon icon={X} size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-16 h-16 rounded-2xl bg-og-primary-dim flex items-center justify-center">
                    {phase === 'ready' ? (
                        <RotateCw size={32} className="text-gn-accent animate-spin" />
                    ) : (
                        <RefreshCw size={32} className="text-gn-accent animate-spin" />
                    )}
                </div>

                <div className="text-center space-y-2">
                    <h1 className="text-og-body text-xl font-bold">آپدیت جدید</h1>
                    <p className="text-og-muted text-sm max-w-xs">{statusText}</p>
                </div>

                <div className="flex items-center gap-6 px-6 py-4 rounded-xl bg-og-subtle border border-og text-sm">
                    <div className="text-center">
                        <div className="text-og-muted text-xs mb-1">ورژن فعلی</div>
                        <div className="font-mono text-og-muted">v{currentVersion}</div>
                    </div>
                    <div className="text-og-muted text-lg">←</div>
                    <div className="text-center">
                        <div className="text-og-muted text-xs mb-1">ورژن جدید</div>
                        <div className="font-mono text-gn-accent font-semibold">v{latestVersion}</div>
                    </div>
                </div>

                <div className="w-full max-w-sm">
                    <div className="h-2 rounded-full overflow-hidden mb-2"
                         style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                width: `${pct}%`,
                                background: 'linear-gradient(90deg, var(--og-primary), #9cf0ff)',
                                boxShadow: '0 0 10px rgba(0,218,243,0.5)',
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--og-muted)' }}>
                        <span>{pct}% دانلود شد</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
