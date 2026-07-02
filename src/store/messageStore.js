import { create } from 'zustand'

export const useMessageStore = create((set, get) => ({
    // unread counts: { friendId: count }
    unreadCounts: {},
    setUnreadCounts: (counts) => set({ unreadCounts: counts }),

    incrementUnread: (friendId) => set(s => ({
        unreadCounts: {
            ...s.unreadCounts,
            [friendId]: (s.unreadCounts[friendId] || 0) + 1
        }
    })),

    clearUnread: (friendId) => set(s => {
        const next = { ...s.unreadCounts }
        delete next[friendId]
        return { unreadCounts: next }
    }),

    // پیام‌های هر گفتگو (cache در حافظه): { friendId: [messages] }
    conversations: {},

    setConversation: (friendId, messages) => set(s => ({
        conversations: { ...s.conversations, [friendId]: messages }
    })),

    // پیام‌های قدیمی‌تر رو ابتدای لیست اضافه کن (pagination به بالا)
    prependMessages: (friendId, older) => set(s => {
        const existing = s.conversations[friendId] || []
        const existingIds = new Set(existing.map(m => m.id))
        const toAdd = older.filter(m => !existingIds.has(m.id))
        return {
            conversations: {
                ...s.conversations,
                [friendId]: [...toAdd, ...existing]
            }
        }
    }),

    addMessage: (friendId, msg) => set(s => {
        const existing = s.conversations[friendId] || []
        // جلوگیری از duplicate
        if (existing.some(m => m.id === msg.id)) return s
        return {
            conversations: {
                ...s.conversations,
                [friendId]: [...existing, msg]
            }
        }
    }),

    // ردیابی نوتیف پیام برای جمع‌بندی: { friendId: { count, username, timer } }
    msgNotifs: {},

    // پیام جدید اومد — count رو زیاد کن (برای جمع‌بندی نوتیف)
    bumpMsgNotif: (friendId, username) => {
        const current = get().msgNotifs[friendId]
        set(s => ({
            msgNotifs: {
                ...s.msgNotifs,
                [friendId]: {
                    count: (current?.count || 0) + 1,
                    username,
                }
            }
        }))
        return (current?.count || 0) + 1
    },

    clearMsgNotif: (friendId) => set(s => {
        const next = { ...s.msgNotifs }
        delete next[friendId]
        return { msgNotifs: next }
    }),

    totalUnread: () => {
        const counts = get().unreadCounts
        return Object.values(counts).reduce((a, b) => a + b, 0)
    },

    // در حال نوشتن DM: { friendId: username }
    dmTyping: {},
    setDmTyping: (friendId, username) => set(s => ({
        dmTyping: { ...s.dmTyping, [friendId]: username }
    })),
    clearDmTyping: (friendId) => set(s => {
        const next = { ...s.dmTyping }
        delete next[friendId]
        return { dmTyping: next }
    }),
}))