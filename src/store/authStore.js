import { create } from 'zustand'
import { performFullLogout } from '../utils/logout'

export const useAuthStore = create((set, get) => ({
    token: null,
    user: null,
    isLoading: true,
    loggingOut: false,

    hydrate: async () => {
        try { await window.electron?.auth.clear() } catch {}
        set({ token: null, user: null, isLoading: false })
    },

    login: async (token, user) => {
        set({ token, user })
    },

    logout: async () => performFullLogout({ skipServer: false }),

    updateUser: (user) => set({ user }),
}))
