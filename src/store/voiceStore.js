import { create } from 'zustand'
import { Room, RoomEvent, Track } from 'livekit-client'
import { voiceAPI, teamAPI } from '../api'

function reEvaluateSubscriptions(room, myChannelId, memberships, mutedIds = []) {
    room.remoteParticipants.forEach((participant) => {
        const theirChannel = memberships[participant.identity] ?? 'lobby'
        const sameChannel  = theirChannel === myChannelId
        const isMuted      = mutedIds.includes(participant.identity)
        const shouldSub    = sameChannel && !isMuted
        participant.trackPublications.forEach((pub) => {
            if (pub.kind === Track.Kind.Audio) pub.setSubscribed(shouldSub)
        })
    })
}

function playJoinChime() {
    try {
        const ctx = new AudioContext()
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880,  ctx.currentTime)
        osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(0.25, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.45)
    } catch {}
}

export const useVoiceStore = create((set, get) => ({
    room: null,
    connected: false,
    connecting: false,
    micEnabled: false,
    micMode: 'always-on',  // 'always-on' | 'push-to-talk'
    pttActive: false,
    speakingIds: [],      // userId هایی که در حال صحبتن
    mutedIds: [],         // userId هایی که لوکال mute شدن
    participantIds: [],   // userId های حاضر در وویس

    // ── channel state ──────────────────────────────────────────────────
    channels: [],         // [{ id, name }]  (always includes 'lobby')
    memberships: {},      // { userId: channelId }
    myChannelId: 'lobby', // which channel I'm currently in

    async connect(groupId) {
        if (get().room || get().connecting) return
        set({ connecting: true })
        try {
            const res = await voiceAPI.token(groupId)
            const { token, url } = res.data

            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            })

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                set({ speakingIds: speakers.map(s => s.identity) })
            })

            const refreshParticipants = () => {
                const ids = Array.from(room.remoteParticipants.values()).map(p => p.identity)
                if (room.localParticipant) ids.push(room.localParticipant.identity)
                set({ participantIds: ids })
            }

            room.on(RoomEvent.ParticipantConnected,    refreshParticipants)
            room.on(RoomEvent.ParticipantDisconnected, refreshParticipants)

            // autoSubscribe is false — only subscribe to same-channel, non-muted tracks
            room.on(RoomEvent.TrackPublished, (publication, participant) => {
                if (publication.kind !== Track.Kind.Audio) return
                const { memberships, myChannelId, mutedIds } = get()
                const theirChannel = memberships[participant.identity] ?? 'lobby'
                if (theirChannel === myChannelId && !mutedIds.includes(participant.identity)) {
                    publication.setSubscribed(true)
                }
            })

            room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
                if (track.kind === Track.Kind.Audio) {
                    const el = track.attach()
                    el.id = `audio-${participant.identity}`
                    if (get().mutedIds.includes(participant.identity)) el.muted = true
                    document.body.appendChild(el)
                }
            })

            room.on(RoomEvent.TrackUnsubscribed, (track) => {
                track.detach().forEach(el => el.remove())
            })

            room.on(RoomEvent.Disconnected, () => {
                set({ connected: false, room: null, speakingIds: [], participantIds: [] })
            })

            await room.connect(url, token, { autoSubscribe: false })

            set({ room, connected: true, connecting: false })
            refreshParticipants()

            // Subscribe to tracks already published by participants who were in
            // the room BEFORE we joined. With autoSubscribe:false LiveKit won't
            // do this for us, and TrackPublished only fires for *future*
            // publications — so without this sweep we stay silent on entry until
            // the next ChannelsUpdated triggers reEvaluateSubscriptions (which is
            // why voice only started working after a team was created/joined).
            const { myChannelId, memberships, mutedIds } = get()
            reEvaluateSubscriptions(room, myChannelId, memberships, mutedIds)
        } catch (e) {
            set({ connecting: false })
            console.error('[voice] connect error', e)
        }
    },

    // Tear down and recreate the LiveKit room. Used by the manual reconnect
    // control and as a recovery path when voice is "connected" but not working.
    async reconnect(groupId, myUserId) {
        const { room } = get()
        if (room) { try { await room.disconnect() } catch {} }
        document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove())
        // Clear connection state so connect()'s guard doesn't bail out.
        set({
            room: null, connected: false, connecting: false, micEnabled: false,
            speakingIds: [], participantIds: [],
        })
        await get().connect(groupId)
        // Re-fetch current team assignments so subscriptions match the real
        // channel layout (connect() alone defaults everyone to 'lobby').
        if (get().room) {
            try {
                const res = await teamAPI.getState(groupId)
                get().applyChannelsUpdate(res.data, myUserId)
            } catch {}
        }
    },

    async disconnect() {
        const { room } = get()
        if (room) {
            try { await room.disconnect() } catch {}
        }
        document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove())
        set({
            room: null, connected: false, micEnabled: false,
            speakingIds: [], participantIds: [],
            channels: [], memberships: {}, myChannelId: 'lobby',
        })
    },

    // ── called by lobbyStore when SignalR ChannelsUpdated fires ────────
    applyChannelsUpdate(channelState, myUserId) {
        const { room, memberships: prev, myChannelId: prevMyCh } = get()
        const newMemberships = channelState.memberships || {}
        const newMyChannelId = newMemberships[myUserId] ?? 'lobby'

        // Play chime when someone *moves into* my (possibly new) channel
        if (room) {
            room.remoteParticipants.forEach((participant) => {
                const prevCh = prev[participant.identity] ?? 'lobby'
                const newCh  = newMemberships[participant.identity] ?? 'lobby'
                // They just arrived in my channel and weren't there before
                if (newCh === newMyChannelId && prevCh !== newMyChannelId
                    && Object.keys(prev).length > 0) {
                    playJoinChime()
                }
            })
        }

        set({
            channels: channelState.channels || [],
            memberships: newMemberships,
            myChannelId: newMyChannelId,
        })

        if (room) {
            reEvaluateSubscriptions(room, newMyChannelId, newMemberships, get().mutedIds)
        }
    },

    // ── microphone controls ────────────────────────────────────────────
    async toggleMic() {
        const { room, micEnabled } = get()
        if (!room) return
        try {
            await room.localParticipant.setMicrophoneEnabled(!micEnabled)
            set({ micEnabled: !micEnabled })
        } catch (e) {
            console.error('[voice] mic toggle error', e)
        }
    },

    setMicMode(mode) {
        const { room, micEnabled } = get()
        if (mode === 'push-to-talk' && micEnabled && room) {
            room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
            set({ micEnabled: false, pttActive: false })
        }
        set({ micMode: mode })
    },

    async startPtt() {
        const { room, micMode, connected, pttActive } = get()
        if (!connected || micMode !== 'push-to-talk' || !room || pttActive) return
        try {
            await room.localParticipant.setMicrophoneEnabled(true)
            set({ pttActive: true, micEnabled: true })
        } catch {}
    },

    async stopPtt() {
        const { room, micMode, pttActive } = get()
        if (micMode !== 'push-to-talk' || !room || !pttActive) return
        try {
            await room.localParticipant.setMicrophoneEnabled(false)
            set({ pttActive: false, micEnabled: false })
        } catch {}
    },

    // mute/unmute لوکال یه participant — از طریق unsubscribe کردن track
    toggleMuteUser(userId) {
        const { room, mutedIds, myChannelId, memberships } = get()
        const isMuted = mutedIds.includes(userId)
        const next    = isMuted ? mutedIds.filter(id => id !== userId) : [...mutedIds, userId]
        set({ mutedIds: next })

        if (room) {
            const participant = Array.from(room.remoteParticipants.values())
                .find(p => p.identity === userId)
            if (participant) {
                participant.trackPublications.forEach((pub) => {
                    if (pub.kind !== Track.Kind.Audio) return
                    const theirChannel = memberships[participant.identity] ?? 'lobby'
                    const sameChannel  = theirChannel === myChannelId
                    // isMuted = old state; toggling: muted→unmute (subscribe), not-muted→mute (unsubscribe)
                    pub.setSubscribed(isMuted && sameChannel)
                })
            }
        }
    },
}))
