import { create } from 'zustand'

// وضعیت پینگ زنده‌ی هر عضو لابی (به ازای userId) + وضعیت «راه‌اندازی مجدد شبکه».
export const usePingStore = create((set) => ({
    // userId -> { ok: boolean, failingSince: number|null, warned: boolean }
    status: {},
    resetting: false,

    setResetting: (resetting) => set((s) => (
        resetting
            ? { resetting: true }
            // با پایان ریست، وضعیتِ قبلی پاک می‌شه تا دوباره از صفر سنجیده بشه.
            : { resetting: false, status: {} }
    )),

    setPing: (userId, ok) => set((s) => {
        if (!userId) return s
        const prev = s.status[userId]
        if (ok) {
            if (prev?.ok) return s
            return { status: { ...s.status, [userId]: { ok: true, failingSince: null, warned: false } } }
        }
        const failingSince = (prev && !prev.ok && prev.failingSince) ? prev.failingSince : Date.now()
        return { status: { ...s.status, [userId]: { ok: false, failingSince, warned: prev?.warned || false } } }
    }),

    markWarned: (userId) => set((s) => {
        const prev = s.status[userId]
        if (!prev) return s
        return { status: { ...s.status, [userId]: { ...prev, warned: true } } }
    }),

    clear: () => set({ status: {}, resetting: false }),
}))
