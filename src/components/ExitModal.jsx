import { LogOut } from 'lucide-react'
import Icon from './ui/Icon'

export default function ExitModal({ onQuit, onMinimize, onCancel, quitting = false }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={!quitting ? onCancel : undefined}
            />

            <div
                className="relative w-80 og-panel p-6 shadow-2xl animate-slide-up"
                style={{ boxShadow: '0 0 40px rgba(0,212,255,0.08)' }}>

                {quitting ? (
                    <div className="flex flex-col items-center py-6">
                        <div className="w-11 h-11 border-2 border-og-primary/30 border-t-og-accent rounded-full animate-spin mb-4" />
                        <p className="og-title text-sm text-og-body">در حال خروج...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-5">
                            <div className="w-14 h-14 rounded-xl bg-og-danger-bg border border-og-danger-border flex items-center justify-center">
                                <Icon icon={LogOut} size="lg" className="text-og-danger" />
                            </div>
                        </div>

                        <h3 className="text-center og-title text-base text-og-body mb-1">
                            خروج از TarGame
                        </h3>
                        <p className="text-center text-og-muted text-xs mb-6">
                            اتصال شبکه بازی قطع خواهد شد
                        </p>

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={onQuit}
                                className="og-btn-danger w-full py-2.5 text-sm">
                                خروج از برنامه
                            </button>
                            <button
                                type="button"
                                onClick={onMinimize}
                                className="og-btn-ghost w-full py-2.5 text-sm">
                                کوچک کردن
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full py-2.5 rounded-lg text-og-muted hover:text-og-body transition-colors text-sm">
                                انصراف
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
