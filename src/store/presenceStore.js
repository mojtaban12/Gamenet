import { create } from 'zustand'

export const usePresenceStore = create((set, get) => ({
    hub: null,
    setHub: (hub) => set({ hub }),

    friends: [],
    setFriends: (friends) => set({ friends }),

    updateFriend: (userId, online) => {
        const target = String(userId).toLowerCase()
        const friends = get().friends
        const exists = friends.some(f => String(f.friendId).toLowerCase() === target)

        if (exists) {
            set({
                friends: friends.map(f =>
                    String(f.friendId).toLowerCase() === target ? { ...f, online } : f
                )
            })
            return true
        }
        return false
    },

    updateFriendAvatar: (userId, avatarUrl) => {
        const target = String(userId).toLowerCase()
        set({
            friends: get().friends.map(f =>
                String(f.friendId).toLowerCase() === target ? { ...f, avatarUrl } : f
            )
        })
    }
}))