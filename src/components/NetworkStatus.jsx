import { RotateCw, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useSetupStore, PHASE, PHASE_PROGRESS, PHASE_LABEL } from '../store/setupStore'
import { runSetup } from '../lib/setupRunner'
import Icon from './ui/Icon'

const STEPS = [
    { phase: PHASE.CHECKING,    label: 'بررسی' },
    { phase: PHASE.INSTALLING,  label: 'نصب'   },
    { phase: PHASE.CONNECTING,  label: 'اتصال' },
    { phase: PHASE.REGISTERING, label: 'ثبت'   },
]

const PHASE_ORDER = [PHASE.CHECKING, PHASE.INSTALLING, PHASE.CONNECTING, PHASE.REGISTERING, PHASE.DONE]

function stepState(stepPhase, currentPhase) {
    const stepIdx    = PHASE_ORDER.indexOf(stepPhase)
    const currentIdx = PHASE_ORDER.indexOf(currentPhase)
    if (currentIdx > stepIdx) return 'done'
    if (currentIdx === stepIdx) return 'active'
    return 'pending'
}

export default function NetworkStatus() {
    const { phase, currentLog, logs, error } = useSetupStore()

    if (phase === PHASE.IDLE || phase === PHASE.DONE) return null

    const progress  = PHASE_PROGRESS[phase] ?? 0
    const isError   = phase === PHASE.ERROR
    const isSpinner = !isError

    return (
        <div
            className="rounded-xl p-3 mb-3 flex flex-col gap-2"
            style={{
                background: isError
                    ? 'rgba(255,75,137,0.08)'
                    : 'rgba(0,218,243,0.06)',
                border: `1px solid ${isError ? 'rgba(255,75,137,0.2)' : 'rgba(0,218,243,0.15)'}`,
            }}>

            {/* Header */}
            <div className="flex items-center gap-2">
                {isError
                    ? <Icon icon={AlertCircle} size="xs" className="shrink-0" style={{ color: 'var(--gn-red)' }} />
                    : <Icon icon={Wifi} size="xs" className="shrink-0 animate-pulse" style={{ color: 'var(--og-primary)' }} />
                }
                <span className="text-xs font-semibold truncate" style={{ color: isError ? 'var(--gn-red)' : 'var(--og-primary)' }}>
                    {isError ? 'مشکل در برقراری اتصال' : 'آماده‌سازی شبکه...'}
                </span>
            </div>

            {!isError && (
                <>
                    {/* Step dots */}
                    <div className="flex items-center gap-1 justify-between px-0.5">
                        {STEPS.map((s, i) => {
                            const state = stepState(s.phase, phase)
                            return (
                                <div key={s.phase} className="flex items-center gap-1 flex-1 min-w-0">
                                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                                        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                            state === 'done'   ? 'bg-green-400'
                                            : state === 'active' ? 'bg-[var(--og-primary)] animate-pulse shadow-[0_0_6px_var(--og-primary)]'
                                            : 'bg-white/15'
                                        }`} />
                                        <span className="text-[9px] leading-none" style={{ color: state === 'pending' ? 'var(--og-muted)' : state === 'active' ? 'var(--og-primary)' : '#22c55e' }}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className="flex-1 h-px mt-[-8px]" style={{ background: state === 'done' ? '#22c55e40' : 'rgba(255,255,255,0.08)' }} />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--og-primary), #9cf0ff)',
                                boxShadow: '0 0 8px var(--og-primary)',
                            }}
                        />
                    </div>

                    {/* Current log */}
                    {currentLog && (
                        <div className="text-[10px] leading-tight truncate" style={{ color: 'var(--og-muted)' }}>
                            {currentLog}
                        </div>
                    )}
                </>
            )}

            {isError && (
                <>
                    <div className="text-[10px] leading-snug line-clamp-2" style={{ color: 'var(--og-muted)' }}>
                        {error}
                    </div>
                    <button
                        type="button"
                        onClick={runSetup}
                        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ background: 'rgba(255,75,137,0.15)', color: 'var(--gn-red)', border: '1px solid rgba(255,75,137,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,75,137,0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,75,137,0.15)' }}>
                        <Icon icon={RotateCw} size={11} />
                        تلاش مجدد
                    </button>
                </>
            )}
        </div>
    )
}
