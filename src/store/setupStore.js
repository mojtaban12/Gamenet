import { create } from 'zustand'

export const PHASE = {
    IDLE:        'idle',
    CHECKING:    'checking',
    INSTALLING:  'installing',
    CONNECTING:  'connecting',
    REGISTERING: 'registering',
    DONE:        'done',
    ERROR:       'error',
}

export const PHASE_PROGRESS = {
    idle:        0,
    checking:    12,
    installing:  38,
    connecting:  65,
    registering: 85,
    done:        100,
    error:       0,
}

export const PHASE_LABEL = {
    idle:        '',
    checking:    'بررسی سیستم',
    installing:  'نصب ماژول',
    connecting:  'اتصال شبکه',
    registering: 'ثبت هویت',
    done:        'آماده',
    error:       'خطا',
}

export const useSetupStore = create((set) => ({
    phase: PHASE.IDLE,
    currentLog: '',
    logs: [],
    error: null,

    setPhase:   (phase)         => set({ phase }),
    setError:   (error)         => set({ error, phase: PHASE.ERROR }),
    setDone:    ()              => set({ phase: PHASE.DONE, error: null }),
    reset:      ()              => set({ phase: PHASE.IDLE, currentLog: '', logs: [], error: null }),
    addLog: (msg, type = 'info') => set(s => ({
        currentLog: msg,
        logs: [...s.logs.slice(-39), { id: Date.now() + Math.random(), msg, type }],
    })),
}))
