import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import i18n from '../i18n'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
})

// Attach JWT token to every request
api.interceptors.request.use(config => {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Global error handling:
//   401 → force logout
//   No response (network down / timeout) → global toast (components can't detect this on their own)
//   HTTP errors (4xx/5xx) → re-throw; each call site shows its own inline error
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            // Only force logout when we still consider ourselves authenticated and
            // aren't already tearing the session down. logout() calls authenticated
            // endpoints (releasePeer etc.) which can themselves 401 — without this
            // guard each 401 re-triggers logout() in an infinite loop that hangs the app.
            const { token, loggingOut, logout } = useAuthStore.getState()
            if (token && !loggingOut) logout()
        } else if (!err.response) {
            // No HTTP response = user's network is down or the request timed out.
            // Blame the connection, not the service.
            useNotificationStore.getState().toast(
                i18n.t('common.internetUnstable'),
                'error',
                7000
            )
        }
        return Promise.reject(err)
    }
)

// ─────────────── AUTH ─────────────────────────────────────────────────

export const authAPI = {
    register:       (data)                        => api.post('/api/auth/register', data),
    login:          (data)                        => api.post('/api/auth/login', data),
    logout:         ()                            => api.post('/api/auth/logout'),
    changePassword: (currentPassword, newPassword) =>
        api.post('/api/auth/change-password', { currentPassword, newPassword }),
    forgotPassword: (email)                        => api.post('/api/auth/forgot-password', { email }),
    resetPassword:  (email, token, newPassword)    =>
        api.post('/api/auth/reset-password', { email, token, newPassword }),
}

// ─────────────── USER ─────────────────────────────────────────────────

export const userAPI = {
    me: () => api.get('/api/user/me'),
}

// ─────────────── NETBIRD ──────────────────────────────────────────────

export const netbirdAPI = {
    getSetupKey:  ()             => api.post('/api/tarlan/setup-key'),
    registerPeer: (peerId)       => api.put('/api/tarlan/peer', { peerId }),
    getMyPeer:    ()             => api.get('/api/tarlan/peer/me'),
    releasePeer:  ()             => api.post('/api/tarlan/peer/release'),
    getPeerByIp:  (ip)           => api.get(`/api/tarlan/peer/by-ip?ip=${ip}`),
    getConfig:    ()             => api.get('/api/user/netbird-config'),

    // Groups
    createGroup:  (name, isPrivate = false, password = '') =>
        api.post('/api/tarlan/groups', { name, isPrivate, password }),
    getGroups:    ()             => api.get('/api/tarlan/groups'),
    joinGroup:    (groupId, password = '') =>
        api.post(`/api/tarlan/groups/${groupId}/join`, password ? { password } : undefined),
    leaveGroup:   (groupId)      => api.delete(`/api/tarlan/groups/${groupId}/leave`),
}

// ─────────────── VPN (رفع تحریم) ───────────────────────────────────────

export const vpnAPI = {
    listServers: ()         => api.get('/api/vpn/servers'),
    status:      ()         => api.get('/api/vpn/status'),
    connect:     (serverId) => api.post(`/api/vpn/servers/${serverId}/connect`),
    disconnect:  ()         => api.post('/api/vpn/disconnect'),
}

// ─────────────── FRIENDS ──────────────────────────────────────────────

export const friendAPI = {
    getAll:      ()                              => api.get('/api/friends'),
    getRequests: ()                              => api.get('/api/friends/requests'),
    search:      (q)                             => api.get(`/api/friends/search?q=${q}`),
    sendRequest: (username)                      => api.post('/api/friends/request', { username }),
    respond:     (requestId, accept)             => api.put(`/api/friends/request/${requestId}`, { accept }),
    remove:      (friendId)                      => api.delete(`/api/friends/${friendId}`),
    invite:      (friendId, groupId, groupName)  => api.post('/api/friends/invite', { friendId, groupId, groupName }),
}

// ─────────────── NOTIFICATIONS ────────────────────────────────────────

export const messageAPI = {
    getHistory:    (friendId, before) => api.get(`/api/messages/${friendId}${before ? `?before=${before}` : ''}`),
    getUnreadCounts: ()               => api.get('/api/messages/unread/counts'),
    getTotalUnread:  ()               => api.get('/api/messages/unread/total'),
}

export const gameAPI = {
    list: () => api.get('/api/games'),
}

export const streamAPI = {
    start:  ()          => api.post('/api/stream/start'),
    stop:   (ingressId) => api.post('/api/stream/stop', { ingressId }),
    status: ()          => api.get('/api/stream/status'),
}

export const voiceAPI = {
    token: (groupId) => api.get(`/api/liveroom/token/${groupId}`),
}

export const teamAPI = {
    getState:    (groupId)            => api.get(`/api/liveroom/teams/${groupId}`),
    createTeam:  (groupId, name)      => api.post(`/api/liveroom/teams/${groupId}`, { name }),
    deleteTeam:  (groupId, channelId) => api.delete(`/api/liveroom/teams/${groupId}/${channelId}`),
    joinChannel: (groupId, channelId) => api.post(`/api/liveroom/channels/${groupId}/join/${channelId}`),
    leaveChannel:(groupId)            => api.post(`/api/liveroom/channels/${groupId}/leave`),
}

export const tincAPI = {
    register:    ()                       => api.post('/api/p2player/register'),
    joinLobby:   (lobbyId, underlayIp)    => api.post(`/api/p2player/lobby/${lobbyId}/join`, { underlayIp }),
    leaveLobby:  (lobbyId)                => api.post(`/api/p2player/lobby/${lobbyId}/leave`),
    getVersion:  (lobbyId)                => api.get(`/api/p2player/lobby/${lobbyId}/version`),
    // config zip به صورت base64 برمی‌گردد
    getConfig:   (lobbyId)                => api.get(`/api/p2player/lobby/${lobbyId}/config`, { responseType: 'arraybuffer' }),
    getState:    (lobbyId)                => api.get(`/api/p2player/lobby/${lobbyId}/state`),
    lockGame:    (lobbyId, gameId, gameName) => api.post(`/api/p2player/lobby/${lobbyId}/lock-game`, { gameId, gameName }),
    setPlaying:  (lobbyId, isPlaying)     => api.post(`/api/p2player/lobby/${lobbyId}/playing`, { isPlaying }),
}

export const adminAPI = {
    // Lobbies
    getLobbies:   ()                         => api.get('/api/admin/lobbies'),

    // Settings
    updateSetting: (key, value)              => api.put(`/api/admin/settings/${key}`, { value }),

    // Games
    getAllGames:   ()                         => api.get('/api/admin/games'),
    getGame:      (id)                        => api.get(`/api/admin/games/${id}`),
    createGame:   (data)                      => api.post('/api/admin/games', data),
    updateGame:   (id, data)                  => api.put(`/api/admin/games/${id}`, data),
    deleteGame:   (id)                        => api.delete(`/api/admin/games/${id}`),
    restoreGame:  (id)                        => api.post(`/api/admin/games/${id}/restore`),

    // Users
    getAllUsers:   ()                          => api.get('/api/admin/users'),
    deleteUser:   (id)                        => api.delete(`/api/admin/users/${id}`),
    restoreUser:  (id)                        => api.post(`/api/admin/users/${id}/restore`),
    setUserRoles: (id, roles)                 => api.put(`/api/admin/users/${id}/roles`, { roles }),

    // Upload
    uploadGameLogo: (gameId, file)            => {
        const form = new FormData()
        form.append('file', file)
        return api.post(`/api/admin/upload/game/${gameId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },

    // Version
    publishVersion: (data)                    => api.post('/api/admin/version', data),
}

export const versionAPI = {
    check: () => api.get('/api/version'),
}

export const notifAPI = {
    getUnread:   ()   => api.get('/api/notifications'),
    getCount:    ()   => api.get('/api/notifications/count'),
    markRead:    (id) => api.put(`/api/notifications/${id}/read`),
    markAllRead: ()   => api.put('/api/notifications/read-all'),
}

// ─────────────── SETTINGS ─────────────────────────────────────────────

export const settingAPI = {
    getAll:      ()             => api.get('/api/setting'),
    update:      (key, value)   => api.put(`/api/setting/${key}`, { value }),
    getAdmin:    ()             => api.get('/api/setting/admin'),
    updateAdmin: (key, value)   => api.put(`/api/admin/settings/${key}`, { value }),
}

// ─────────────── UPLOAD ───────────────────────────────────────────────

export const uploadAPI = {
    avatar: (file) => {
        const form = new FormData()
        form.append('file', file)
        return api.post('/api/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
}

export default api