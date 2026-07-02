import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, RotateCw, Wifi } from 'lucide-react'
import { useSetupStore, PHASE, PHASE_PROGRESS } from '../store/setupStore'
import { runSetup } from '../lib/setupRunner'
import Icon from './ui/Icon'

const STEPS = [
    { phase: PHASE.CHECKING,    label: 'بررسی سیستم' },
    { phase: PHASE.INSTALLING,  label: 'نصب ماژول'   },
    { phase: PHASE.CONNECTING,  label: 'اتصال شبکه'  },
    { phase: PHASE.REGISTERING, label: 'ثبت هویت'    },
]

const PHASE_ORDER = [PHASE.CHECKING, PHASE.INSTALLING, PHASE.CONNECTING, PHASE.REGISTERING, PHASE.DONE]

function stepState(stepPhase, currentPhase) {
    const stepIdx    = PHASE_ORDER.indexOf(stepPhase)
    const currentIdx = PHASE_ORDER.indexOf(currentPhase)
    if (currentPhase === PHASE.DONE) return 'done'
    if (currentIdx > stepIdx) return 'done'
    if (currentIdx === stepIdx) return 'active'
    return 'pending'
}

export default function NetworkGateBanner() {
    const { phase, logs, currentLog, error } = useSetupStore()
    const [expanded, setExpanded] = useState(false)
    const logRef = useRef(null)

    useEffect(() => {
        if (expanded && logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [logs, expanded])

    if (phase === PHASE.IDLE || phase === PHASE.DONE) return null

    const isError   = phase === PHASE.ERROR
    const progress  = PHASE_PROGRESS[phase] ?? 0

    return (
        <div
            className="rounded-xl overflow-hidden mb-4 shrink-0"
            style={{
                border: `1px solid ${isError ? 'rgba(255,75,137,0.25)' : 'rgba(0,218,243,0.2)'}`,
                background: isError ? 'rgba(255,75,137,0.06)' : 'rgba(0,218,243,0.05)',
            }}>

            {/* Main row */}
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Icon */}
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: isError ? 'rgba(255,75,137,0.15)' : 'rgba(0,218,243,0.12)' }}>
                    <Icon icon={Wifi} size="xs"
                        className={isError ? '' : 'animate-pulse'}
                        style={{ color: isError ? 'var(--gn-red)' : 'var(--og-primary)' }} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: isError ? 'var(--gn-red)' : 'var(--og-primary)' }}>
                        {isError ? 'خطا در راه‌اندازی شبکه' : 'شبکه در حال آماده‌سازی...'}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--og-muted)' }}>
                        {isError ? error : (currentLog || 'لطفاً صبر کنید...')}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {isError && (
                        <button
                            type="button"
                            onClick={runSetup}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                            style={{ background: 'rgba(255,75,137,0.15)', color: 'var(--gn-red)', border: '1px solid rgba(255,75,137,0.3)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,75,137,0.25)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,75,137,0.15)' }}>
                            <Icon icon={RotateCw} size={11} />
                            تلاش مجدد
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                        style={{ color: 'var(--og-muted)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--og-text)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--og-muted)' }}>
                        جزئیات
                        <Icon icon={expanded ? ChevronUp : ChevronDown} size={11} />
                    </button>
                </div>
            </div>

            {/* Progress bar (always visible, not in error state) */}
            {!isError && (
                <div className="px-4 pb-3">
                    {/* Steps */}
                    <div className="flex items-center gap-0 mb-2">
                        {STEPS.map((s, i) => {
                            const state = stepState(s.phase, phase)
                            return (
                                <div key={s.phase} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-500 ${
                                            state === 'done'
                                                ? 'bg-green-400/20 border-green-400 text-green-400'
                                                : state === 'active'
                                                    ? 'bg-[var(--og-primary)]/20 border-[var(--og-primary)] text-[var(--og-primary)] animate-pulse'
                                                    : 'border-white/10 text-white/20'
                                        }`}>
                                            {state === 'done' ? '✓' : i + 1}
                                        </div>
                                        <span className={`text-[9px] whitespace-nowrap transition-colors duration-300 ${
                                            state === 'done'   ? 'text-green-400'
                                            : state === 'active' ? 'text-[var(--og-primary)]'
                                            : 'text-white/20'
                                        }`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`flex-1 h-px mx-1 mb-4 transition-all duration-500 ${
                                            state === 'done' ? 'bg-green-400/40' : 'bg-white/08'
                                        }`} style={{ background: state === 'done' ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.06)' }} />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--og-primary), #9cf0ff)',
                                boxShadow: '0 0 6px var(--og-primary)',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Expandable logs */}
            {expanded && (
                <div
                    ref={logRef}
                    className="border-t px-4 py-3 font-mono text-[10px] space-y-1 overflow-y-auto"
                    style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        background: 'rgba(0,0,0,0.2)',
                        maxHeight: '140px',
                        color: 'var(--og-muted)',
                    }}>
                    {logs.length === 0 && <div className="opacity-40">در انتظار شروع...</div>}
                    {logs.map(l => (
                        <div key={l.id} className={`flex gap-2 ${
                            l.type === 'error'   ? 'text-red-400'
                            : l.type === 'success' ? 'text-green-400'
                            : 'text-og-muted'
                        }`} style={{ color: l.type === 'error' ? '#f87171' : l.type === 'success' ? '#4ade80' : 'var(--og-muted)' }}>
                            <span className="opacity-40 shrink-0">›</span>
                            <span>{l.msg}</span>
                        </div>
                    ))}
                    {phase !== PHASE.DONE && phase !== PHASE.ERROR && (
                        <div style={{ color: 'var(--og-primary)' }} className="animate-pulse">▊</div>
                    )}
                </div>
            )}
        </div>
    )
}
