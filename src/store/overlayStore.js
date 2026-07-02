import { create } from 'zustand'

/**
 * حالت overlay: وقتی کاربر با شورت‌کات (Ctrl+~) پنجره رو در بازی میاره بالا.
 * در این حالت پنجره کوچیکه و فقط لابی/چت نشون داده می‌شه (بدون سایدبار).
 */
export const useOverlayStore = create((set) => ({
    overlayMode: false,
    setOverlayMode: (v) => set({ overlayMode: v }),
}))

// به رویداد main process گوش بده
if (typeof window !== 'undefined' && window.electron?.shortcut?.onOverlayToggled) {
    window.electron.shortcut.onOverlayToggled((v) => {
        useOverlayStore.getState().setOverlayMode(!!v)
    })
}