import { create } from 'zustand'

export const useUpdateStore = create((set) => ({
    phase:    'idle',   // idle | checking | available | downloading | ready | force-prompt | force | error
    progress: null,     // { percent }
    updates:  [],       // [{ component, version }]
    silent:   false,    // true = background update (user is in-game)
    deferred: false,    // true = user chose "later" — download silently, don't auto-install
    error:    null,

    setChecking:    ()              => set({ phase: 'checking', error: null }),
    setAvailable:   (updates, silent = false) => set({ phase: 'available', updates, silent }),
    setForcePrompt: (updates)       => set({ phase: 'force-prompt', updates, silent: false, deferred: false }),
    setForce:       (updates)       => set({ phase: 'force', updates, silent: false, deferred: false }),
    setDownloading: ()              => set({ phase: 'downloading' }),
    setProgress:    (progress)      => set({ phase: 'downloading', progress }),
    setReady:       ()              => set({ phase: 'ready' }),
    setNotAvailable:()              => set({ phase: 'idle' }),
    setError:       (message)       => set({ phase: 'error', error: message }),
    setDeferred:    (updates)       => set({ phase: 'downloading', deferred: true, updates }),
    reset:          ()              => set({ phase: 'idle', progress: null, updates: [], deferred: false, error: null }),
}))
