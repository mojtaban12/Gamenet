import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
    token: null,
    user: null,
    isLoading: true,
    loggingOut: false,

    // token را ذخیره نمی‌کنیم — هر بار اپ که باز شود، کاربر باید دوباره لاگین کند.
    // این جلوگیری می‌کند که قبل از لاگین، با token قدیمی نوتیف بیاید.
    hydrate: async () => {
        // پاک کردن هر token قدیمی که ممکن است از نسخه‌های قبلی مانده باشد
        try { await window.electron?.auth.clear() } catch {}
        set({ token: null, user: null, isLoading: false })
    },

    login: async (token, user) => {
        // فقط در حافظه — ذخیره دائم نمی‌کنیم
        set({ token, user })
    },

    logout: async () => {
        // Idempotent: logout() itself calls authenticated endpoints (authAPI.logout,
        // netbirdAPI.releasePeer). If the session is already invalid on the server,
        // those return 401 → the axios interceptor would call logout() again →
        // releasePeer → 401 → logout()… an infinite loop that hangs the app.
        // This guard (plus the token check in the interceptor) breaks the cycle.
        if (get().loggingOut || !get().token) return
        set({ loggingOut: true })
        try {
            // اول به سرور خبر بده تا سشن باطل و presence فوراً از Redis پاک بشه
            // (قبل از پاک‌کردن توکن، چون این درخواست به توکن نیاز داره)
            try {
                const { authAPI } = await import('../api')
                await authAPI.logout()
            } catch {}
            // peer رو از سرور نت‌برد حذف کن (تا کاربر بعدی با اسم خودش از نو ثبت شه)
            try {
                const { netbirdAPI } = await import('../api')
                await netbirdAPI.releasePeer()
            } catch {}
            // سرویس نت‌برد ویندوز رو پاک کن
            try { await window.electron?.netbird.uninstall() } catch {}
            set({ token: null, user: null })
            try { await window.electron?.auth.clear() } catch {}
        } finally {
            set({ loggingOut: false })
        }
    },

    updateUser: (user) => set({ user }),
}))