import { create } from 'zustand'
import { streamAPI } from '../api'

/**
 * مدیریت استریم با LiveKit + OBS.
 * جریان:
 *   1. سرور Ingress می‌سازه (rtmpUrl + streamKey)
 *   2. به OBS وصل می‌شیم
 *   3. (حالت خودکار) scene + Game Capture می‌سازیم
 *   4. RTMP رو ست و StartStream
 */
export const useStreamStore = create((set, get) => ({
    streaming: false,
    connecting: false,
    ingressId: null,
    watchUrl: null,
    error: null,

    // mode: 'manual' (کاربر صحنه خودش) | 'auto' (ما Game Capture می‌سازیم)
    async startStream({ mode = 'manual', exeName = null, obsPort = 4455, obsPassword = '' }) {
        set({ connecting: true, error: null })
        try {
            // ۱. اتصال به OBS (اگه بسته باشه، main process اتوماتیک لانچش می‌کنه)
            const conn = await window.electron.obs.connect({ port: obsPort, password: obsPassword })
            if (!conn.success) {
                const errCode = conn.error || 'obs_not_connected'
                set({ connecting: false, error: errCode })
                return { success: false, error: errCode, detail: conn.detail }
            }

            // ۲. ساخت Ingress روی سرور
            const res = await streamAPI.start()
            const { ingressId, rtmpUrl, streamKey, watchUrl } = res.data

            // ۳+۴. استریم: در حالت auto صحنه و Game Capture ساخته می‌شه،
            //       بعد RTMP ست و StartStream
            const started = await window.electron.obs.startStream({
                rtmpUrl, streamKey, auto: mode === 'auto'
            })
            if (!started.success) {
                await streamAPI.stop(ingressId).catch(() => {})
                set({ connecting: false, error: started.error })
                return { success: false, error: started.error }
            }

            set({ streaming: true, connecting: false, ingressId, watchUrl })
            return { success: true, watchUrl }
        } catch (e) {
            set({ connecting: false, error: e.message })
            return { success: false, error: e.message }
        }
    },

    async stopStream() {
        const { ingressId } = get()
        try { await window.electron.obs.stopStream() } catch {}
        try { await streamAPI.stop(ingressId) } catch {}
        set({ streaming: false, ingressId: null, watchUrl: null })
    },
}))