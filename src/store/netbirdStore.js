import { create } from 'zustand'

export const useNetbirdStore = create((set, get) => ({
    connected: false,
    ip: null,
    tincIp: null,
    peerId: null,
    peers: [],
    installing: false,
    connecting: false,
    reconnecting: false,
    needsReregister: false,
    error: null,

    setStatus: (status) => set({
        connected: status.connected,
        ip: status.ip,
        peerId: status.peerId,
        peers: status.peers || [],
        error: null
    }),

    applyWatchStatus: (status) => set(s => ({
        connected: !!status.connected,
        ip: status.ip ?? s.ip,
        peers: status.peers || s.peers,
        reconnecting: !!status.reconnecting,
        needsReregister: !!status.needsReregister,
    })),

    clearNeedsReregister: () => set({ needsReregister: false }),

    setTincIp: (ip) => set({ tincIp: ip }),
    setInstalling: (v) => set({ installing: v }),
    setConnecting: (v) => set({ connecting: v }),
    setError: (e)      => set({ error: e }),
    clearError: ()     => set({ error: null }),
}))