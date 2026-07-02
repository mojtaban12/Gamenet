import { create } from 'zustand'

const STORAGE_KEY = 'targame-theme'

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = create((set, get) => ({
    theme: 'dark',

    hydrate: () => {
        const saved = localStorage.getItem(STORAGE_KEY)
        const theme = saved === 'light' ? 'light' : 'dark'
        applyTheme(theme)
        set({ theme })
    },

    setTheme: (theme) => {
        localStorage.setItem(STORAGE_KEY, theme)
        applyTheme(theme)
        set({ theme })
    },

    toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        get().setTheme(next)
    },
}))
