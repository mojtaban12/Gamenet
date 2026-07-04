import { create } from 'zustand'
import * as signalR from '@microsoft/signalr'
import { netbirdAPI, teamAPI } from '../api'
import { useAuthStore } from './authStore'
import { useVoiceStore } from './voiceStore'
import { refreshMesh, tearDownMesh } from '../utils/meshNetwork'
import i18n from '../i18n'

const getApiUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:5224'

let hubRef = null
let appliedVersion = 0
let meshActive = false
let sessionGroupId = null
let connecting = false
const typingTimers = {}

function mapMessage(msg, currentUserId) {
    return {
        id:              msg.id,
        senderId:        msg.senderId,
        senderName:      msg.senderName,
        senderAvatarUrl: msg.senderAvatarUrl,
        message:         msg.message,
        sentAt:          msg.sentAt,
        isMine:          msg.senderId === currentUserId?.toString(),
    }
}

function addSystemMessage(text) {
    useLobbyStore.setState(s => ({
        messages: [...s.messages, {
            id: `sys-${Date.now()}-${Math.random()}`,
            system: true,
            message: text,
            sentAt: new Date().toISOString(),
        }],
    }))
}

export const useLobbyStore = create(() => ({
    activeLobby: null,
    members: [],
    messages: [],
    connected: false,
    hubReady: false,
    leaving: false,
    typingUsers: [],  // [{ userId, username }]
    hostId: null,     // userId of current lobby host (updates on HostChanged)
}))

export function getLobbyHub() {
    return hubRef
}

export function getMeshState() {
    return { appliedVersion, meshActive, setMeshActive: (v) => { meshActive = v }, setAppliedVersion: (v) => { appliedVersion = v } }
}

function resolveIsHost(groupId, isHost, existing) {
    if (existing?.groupId !== groupId) return isHost === true
    return isHost === true || existing.isHost === true
}

export async function enterLobby(groupId, isHost = false) {
    const { token, user } = useAuthStore.getState()
    if (!token || !groupId) return

    const state = useLobbyStore.getState()
    const resolvedHost = resolveIsHost(groupId, isHost, state.activeLobby)

    if (sessionGroupId === groupId && hubRef?.state === signalR.HubConnectionState.Connected) {
        useLobbyStore.setState({
            activeLobby: { groupId, groupName: state.activeLobby?.groupName || '', isHost: resolvedHost },
        })
        return
    }

    if (sessionGroupId && sessionGroupId !== groupId) {
        await leaveLobby()
    }

    sessionGroupId = groupId
    useLobbyStore.setState({
        activeLobby: { groupId, groupName: '', isHost: resolvedHost },
        members: [],
        messages: [],
        connected: false,
        hubReady: false,
    })

    await connectHub(groupId, token, user?.id)
}

async function connectHub(groupId, token, userId) {
    if (connecting) return
    connecting = true

    if (hubRef) {
        try { await hubRef.stop() } catch {}
        hubRef = null
    }

    try {
        const res = await netbirdAPI.getGroups()
        const group = res.data.find(g => g.id === groupId)
        if (group) {
            useLobbyStore.setState(s => ({
                activeLobby: s.activeLobby ? { ...s.activeLobby, groupName: group.name } : null,
            }))
        }
    } catch {}

    const hub = new signalR.HubConnectionBuilder()
        .withUrl(`${getApiUrl()}/hubs/chat?access_token=${token}`, {
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect()
        .build()

    hub.on('ChatHistory', (history) => {
        useLobbyStore.setState({
            messages: history.map(m => mapMessage(m, userId)),
        })
    })

    hub.on('ReceiveMessage', (msg) => {
        useLobbyStore.setState(s => {
            if (s.messages.some(m => m.id === msg.id)) return s
            return { messages: [...s.messages, mapMessage(msg, userId)] }
        })
    })

    hub.on('MembersUpdated', (memberList) => {
        // Extract host from member list if backend includes isHost flag
        const host = memberList.find(m => m.isHost)
        useLobbyStore.setState(s => ({
            members: memberList,
            hostId: host ? host.userId?.toString() : s.hostId,
        }))
    })

    hub.on('MemberTincIpUpdated', ({ userId, tincIp }) => {
        useLobbyStore.setState(s => ({
            members: s.members.map(m => m.userId === userId ? { ...m, tincIp } : m)
        }))
    })

    hub.on('UserJoined', (data) => {
        addSystemMessage(i18n.t('lobby.userJoined', { username: data.username }))
    })

    hub.on('SystemMessage', (text) => {
        addSystemMessage(text)
    })

    hub.on('UserLeft', (data) => {
        addSystemMessage(i18n.t('lobby.userLeft', { username: data.username }))
        useLobbyStore.setState(s => ({
            typingUsers: s.typingUsers.filter(u => u.userId !== data.userId)
        }))
    })

    // Host transferred to another member (auto on leave, or manual)
    hub.on('HostChanged', (data) => {
        const newHostId = data.newHostId?.toString()
        useLobbyStore.setState({ hostId: newHostId })
        addSystemMessage(i18n.t('lobby.hostChanged', { username: data.newHostUsername || i18n.t('lobby.newUserFallback') }))
    })

    // Current user was kicked — await full cleanup before dispatching lobby:kicked.
    // If cleanup is fire-and-forget, enterLobby short-circuits on re-invite (race)
    // because sessionGroupId + hubRef are still set when the user clicks the invite.
    hub.on('Kicked', async (data) => {
        const currentUserId = useAuthStore.getState().user?.id?.toString()
        if (data.kickedUserId?.toString() === currentUserId) {
            await leaveLobby({ skipHubLeave: true }).catch(() => {})
            window.dispatchEvent(new CustomEvent('lobby:kicked'))
        }
    })

    hub.on('Typing', ({ userId, username }) => {
        useLobbyStore.setState(s => {
            const exists = s.typingUsers.some(u => u.userId === userId)
            if (exists) return s
            return { typingUsers: [...s.typingUsers, { userId, username }] }
        })
        clearTimeout(typingTimers[userId])
        typingTimers[userId] = setTimeout(() => {
            useLobbyStore.setState(s => ({
                typingUsers: s.typingUsers.filter(u => u.userId !== userId)
            }))
        }, 3000)
    })

    hub.on('ChannelsUpdated', (channelState) => {
        useVoiceStore.getState().applyChannelsUpdate(channelState, userId?.toString())
    })

    // A peer joined/left the mesh. We update host files LIVE (refreshMesh now
    // overwrites them in place without restarting tincd or bouncing the TAP
    // adapter), so existing connections never drop — this is what made tinc
    // churn on every alt+tab before (SignalR reconnects while backgrounded
    // re-triggered JoinLobby → MeshUpdated → a full tincd+adapter restart).
    // Only act while a game session's mesh is up; debounce bursts of joins.
    let meshTimer = null
    hub.on('MeshUpdated', (data) => {
        const v = data?.version ?? 0
        if (v <= appliedVersion) return

        clearTimeout(meshTimer)
        meshTimer = setTimeout(() => {
            if (!meshActive) return
            appliedVersion = v
            refreshMesh(groupId).catch(() => {})
        }, 1200)
    })

    hub.onreconnecting(() => useLobbyStore.setState({ connected: false }))
    hub.onreconnected(() => {
        useLobbyStore.setState({ connected: true })
        hub.invoke('JoinLobby', groupId)
    })
    hub.onclose(() => useLobbyStore.setState({ connected: false }))

    try {
        await hub.start()
        hubRef = hub
        useLobbyStore.setState({ connected: true, hubReady: true })
        await hub.invoke('JoinLobby', groupId)
        // Auto-join voice room (mic stays OFF — user enables manually), THEN
        // apply the current team assignments. Order matters: applyChannelsUpdate
        // only re-evaluates subscriptions once the room exists, so fetching team
        // state before connect finished would drop the initial subscribe pass.
        useVoiceStore.getState().connect(groupId)
            .then(() => teamAPI.getState(groupId))
            .then(res => useVoiceStore.getState().applyChannelsUpdate(res.data, userId?.toString()))
            .catch(e => console.error('[lobby] voice auto-connect error', e))
    } catch (err) {
        console.error('SignalR error:', err)
    } finally {
        connecting = false
    }
}

export async function leaveLobby({ skipHubLeave = false } = {}) {
    const groupId = sessionGroupId
    if (!groupId) return

    useLobbyStore.setState({ leaving: true })

    try { await useVoiceStore.getState().disconnect() } catch {}
    try { await tearDownMesh(groupId) } catch {}

    try {
        if (!skipHubLeave && hubRef?.state === signalR.HubConnectionState.Connected) {
            await hubRef.invoke('LeaveLobby', groupId)
        }
        await hubRef?.stop()
    } catch {}

    hubRef = null
    sessionGroupId = null
    appliedVersion = 0
    meshActive = false

    try { await netbirdAPI.leaveGroup(groupId) } catch {}

    useLobbyStore.setState({
        activeLobby: null,
        members: [],
        messages: [],
        connected: false,
        hubReady: false,
        leaving: false,
        hostId: null,
    })
}

export async function sendLobbyMessage(groupId, text) {
    if (!text.trim() || !hubRef) return false
    try {
        await hubRef.invoke('SendMessage', groupId, text.trim())
        return true
    } catch (err) {
        console.error('Send error:', err)
        return false
    }
}
