import { create } from 'zustand'

let _id = 0

export const useNotificationStore = create((set, get) => ({
    notifications: [],

    add: (notif) => {
        const id = ++_id
        set(s => ({ notifications: [...s.notifications, { ...notif, id }] }))
        return id
    },

    remove: (id) => {
        set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
    },

    // toast ساده (آنلاین/آفلاین). onClick اختیاری → toast کلیک‌خور می‌شه
    toast: (message, type = 'info', duration = 5000, onClick = null) => {
        const id = ++_id
        set(s => ({ notifications: [...s.notifications, { id, message, type, duration, kind: 'toast', onClick }] }))
        if (duration > 0) setTimeout(() => get().remove(id), duration)
        return id
    },

    // دعوت لابی (تا قبول/رد بمونه)
    invite: (data) => {
        const id = ++_id
        set(s => ({ notifications: [...s.notifications, { ...data, id, kind: 'invite' }] }))
        return id
    },

    // آپدیت اجباری mid-session
    forceUpdate: (data) => {
        const existing = get().notifications.find(n => n.kind === 'forceUpdate')
        if (existing) return existing.id
        const id = ++_id
        set(s => ({ notifications: [...s.notifications, { ...data, id, kind: 'forceUpdate' }] }))
        return id
    },

    // درخواست فرند
    friendRequest: (data) => {
        const existing = get().notifications
            .find(n => n.kind === 'friendRequest' && String(n.requestId) === String(data.requestId))
        if (existing) return existing.id
        const id = ++_id
        set(s => ({ notifications: [...s.notifications, { ...data, id, kind: 'friendRequest' }] }))
        return id
    },
}))