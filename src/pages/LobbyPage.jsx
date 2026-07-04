import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Crown, MessageCircle, Smile, UserPlus, UserX, Volume2, VolumeX } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { usePresenceStore } from '../store/presenceStore'
import { useNotificationStore } from '../store/notificationStore'
import { useVoiceStore } from '../store/voiceStore'
import { friendAPI } from '../api'
import ChatTextarea from '../components/ChatTextarea'
import { useSettingStore, SETTING_DEFAULTS } from '../store/settingStore'
import {
    useLobbyStore,
    enterLobby,
    leaveLobby,
    sendLobbyMessage,
    getLobbyHub,
    getMeshState,
} from '../store/lobbyStore'
import { useLocaleStore, getDir } from '../store/localeStore'
import EmojiPicker from '../components/EmojiPicker'
import LobbyFriendsPanel from '../components/LobbyFriendsPanel'
import GamePanel from '../components/GamePanel'
import TeamChannels from '../components/TeamChannels'
import VoiceControls from '../components/VoiceControls'
import FloatingChat from '../components/FloatingChat'
import NetworkGateBanner from '../components/NetworkGateBanner'
import AppShell from '../components/AppShell'
import Icon from '../components/ui/Icon'

export default function LobbyPage() {
    const { t }                     = useTranslation()
    const { groupId }               = useParams()
    const navigate                  = useNavigate()
    const location                  = useLocation()
    const { user }                  = useAuthStore()
    const { ip: myIp, tincIp: myTincIp } = useNetbirdStore()
    const isHostFromNav             = location.state?.isHost === true
    const { activeLobby, members, messages, connected, hubReady, leaving, hostId } = useLobbyStore()
    const locale                    = useLocaleStore(s => s.locale)
    const dir                       = getDir(locale)
    // The members-column/game+chat-column row is intentionally laid out in the
    // opposite direction of the active locale. This keeps the game+chat panel
    // sandwiched between the members panel and the app sidebar (visually
    // centered) in both RTL and LTR — otherwise the members panel would always
    // hug the sidebar and push chat out to the far edge.
    const rowDir                    = dir === 'rtl' ? 'ltr' : 'rtl'
    // isHost is driven by hostId from the server (via MembersUpdated / HostChanged).
    // Falls back to nav state on initial render before MembersUpdated arrives.
    const isHost                    = hostId
        ? hostId === user?.id?.toString()
        : (activeLobby?.groupId === groupId
            ? (activeLobby?.isHost === true || isHostFromNav)
            : isHostFromNav)
    const groupName                 = activeLobby?.groupName || ''
    const [input, setInput]         = useState('')
    const [showEmoji, setShowEmoji]   = useState(false)
    const [chatFriend, setChatFriend] = useState(null)
    const [copied, setCopied]         = useState(false)
    const [gameStateInfo, setGameStateInfo] = useState({ game: null, playing: false })
    const { toast }                   = useNotificationStore()
    const { friends }                 = usePresenceStore()
    const {
        speakingIds, mutedIds, toggleMuteUser,
        connected: voiceConnected, connecting: voiceConnecting,
        micEnabled, micMode, pttActive, participantIds,
    } = useVoiceStore()
    const pttHotkey        = useSettingStore(s => s.settings['hotkey.voice.ptt'] ?? SETTING_DEFAULTS['hotkey.voice.ptt'])
    const adminSettings    = useSettingStore(s => s.adminSettings)
    const voiceEnabled     = adminSettings['lobby.voice.enabled']  !== 'false'
    const teamsEnabled     = adminSettings['lobby.teams.enabled']  !== 'false'
    const chatEnabled      = adminSettings['lobby.chat.enabled']   !== 'false'
    const friendsChatEnabled = adminSettings['friends.chat.enabled'] !== 'false'
    const messagesEndRef            = useRef(null)
    const messagesContainerRef      = useRef(null)
    const meshState                 = useRef(getMeshState()).current
    const typingThrottle            = useRef(null)
    const { typingUsers }           = useLobbyStore()

    useEffect(() => {
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        enterLobby(groupId, isHostFromNav)
    }, [groupId, isHostFromNav])

    // Navigate away if this user was kicked by admin
    useEffect(() => {
        function onKicked() {
            toast(t('lobby.kickedToast'), 'error', 5000)
            navigate('/rooms')
        }
        window.addEventListener('lobby:kicked', onKicked)
        return () => window.removeEventListener('lobby:kicked', onKicked)
    }, [navigate, toast, t])

    useEffect(() => {
        const el = messagesContainerRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [messages])

    useEffect(() => {
        function onIncoming(e) {
            const { friendId, senderName } = e.detail
            setChatFriend(prev => {
                if (prev && prev.friendId?.toString() === friendId) return prev
                if (prev) {
                    toast(t('lobby.newMessageToast', { name: senderName }), 'info', 6000, () => {
                        const f = usePresenceStore.getState().friends.find(x => x.friendId?.toString() === friendId)
                        setChatFriend(f || { friendId, username: senderName })
                    })
                    return prev
                }
                const f = usePresenceStore.getState().friends.find(x => x.friendId?.toString() === friendId)
                return f || { friendId, username: senderName }
            })
        }
        window.addEventListener('dm:incoming', onIncoming)
        return () => window.removeEventListener('dm:incoming', onIncoming)
    }, [toast, t])

    // ── Overlay state sync ────────────────────────────────────────────
    useEffect(() => {
        if (!window.electron?.overlay) return
        const activeIp = gameStateInfo.playing
            ? (gameStateInfo.game?.gameType !== 2 ? myTincIp : myIp)
            : null
        window.electron.overlay.updateState({
            groupId, groupName, members, myIp, user, messages, connected,
            voiceConnected, voiceConnecting, micEnabled, micMode, pttActive, speakingIds, participantIds,
            activeIp,
            pttHotkey,
            selectedGameType: gameStateInfo.game?.gameType ?? null,
            lobbyPlaying: gameStateInfo.playing,
        })
    }, [groupId, groupName, members, myIp, myTincIp, user, messages, connected,
        voiceConnected, voiceConnecting, micEnabled, micMode, pttActive, speakingIds, participantIds,
        gameStateInfo, pttHotkey])

    useEffect(() => {
        if (!window.electron?.overlay) return
        return () => window.electron.overlay.updateState(null)
    }, [])

    useEffect(() => {
        if (!window.electron?.overlay) return
        return window.electron.overlay.onIncomingMessage((text) => {
            sendLobbyMessage(groupId, text)
        })
    }, [groupId])

    useEffect(() => {
        if (!window.electron?.overlay) return
        return window.electron.overlay.onIncomingVoiceAction(({ action, payload }) => {
            const store = useVoiceStore.getState()
            switch (action) {
                case 'connect':     store.connect(payload?.groupId || groupId); break
                case 'disconnect':  store.disconnect(); break
                case 'toggleMic':   store.toggleMic(); break
                case 'setMicMode':  store.setMicMode(payload?.mode); break
                case 'startPtt':    store.startPtt(); break
                case 'stopPtt':     store.stopPtt(); break
            }
        })
    }, [groupId])

    // Actions from the native in-game DLL overlay (mute, chat, copyIp)
    useEffect(() => {
        if (!window.electron?.overlay?.onAction) return
        return window.electron.overlay.onAction(({ type, userId, message }) => {
            if (type === 'mute')  useVoiceStore.getState().toggleMuteUser(userId)
            if (type === 'chat')  sendLobbyMessage(groupId, message)
        })
    }, [groupId])

    useEffect(() => {
        if (!window.electron?.shortcut?.onGlobalToggleMic) return
        return window.electron.shortcut.onGlobalToggleMic(() => {
            const store = useVoiceStore.getState()
            if (store.micMode !== 'push-to-talk') store.toggleMic()
        })
    }, [])
    // ─────────────────────────────────────────────────────────────────

    async function handleLeave() {
        await leaveLobby()
        navigate('/rooms')
    }

    async function handleKick(targetUserId) {
        try { await getLobbyHub()?.invoke('KickUser', groupId, targetUserId) } catch {}
    }

    async function handleTransferHost(targetUserId) {
        try { await getLobbyHub()?.invoke('TransferHost', groupId, targetUserId) } catch {}
    }

    async function handleAddFriend(m) {
        if (!m.username) return
        try {
            await friendAPI.sendRequest(m.username)
            toast(t('lobby.friendRequestSent', { username: m.username }), 'success')
        } catch (e) {
            toast(e.response?.data?.message || t('lobby.friendRequestError'), 'error')
        }
    }

    async function sendMessage() {
        const sent = await sendLobbyMessage(groupId, input)
        if (sent) setInput('')
    }

    function isMe(m) {
        return m.userId === user?.id?.toString() || m.peerId === user?.netbirdPeerId
    }

    function isFriend(m) {
        if (!m.userId) return true // اگه userId نداریم نمی‌تونیم درخواست بفرستیم؛ دکمه رو مخفی کن
        return friends.some(f => f.friendId?.toString() === m.userId?.toString())
    }

    return (
        <AppShell>
            <div className="shrink-0">
                <NetworkGateBanner />
            </div>
            <div dir={rowDir} className="flex flex-1 min-h-0 min-w-0 gap-3 items-stretch overflow-hidden">
                <div dir={dir} className="w-60 max-w-[26vw] shrink-0 min-h-0 og-panel flex flex-col overflow-hidden">
                    <div className="og-lobby-col-head px-3">
                        <p className="og-label text-og-muted truncate">{t('lobby.membersPanelTitle')}</p>
                    </div>

                    <section className="flex-1 min-h-0 flex flex-col overflow-hidden border-b border-og/50">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0">
                            <p className="og-label text-og-muted truncate">
                                {t('lobby.membersLabel')}
                                <span className="text-og-body font-normal mx-1">· {members.length}</span>
                            </p>
                            {voiceEnabled && <VoiceControls groupId={groupId} userId={user?.id?.toString()} />}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-2">
                            {members.length === 0 ? (
                                <p className="text-center py-6 text-og-muted text-xs">{t('lobby.noOneYet')}</p>
                            ) : (
                                members.map((m, i) => (
                                    <MemberRow
                                        key={m.peerId || m.userId || i}
                                        member={m}
                                        isMe={isMe(m)}
                                        isCurrentUserHost={isHost}
                                        isFriend={isFriend(m)}
                                        speaking={speakingIds.includes(m.userId)}
                                        muted={mutedIds.includes(m.userId)}
                                        gameInfo={gameStateInfo}
                                        onToggleMute={() => toggleMuteUser(m.userId)}
                                        onKick={isHost && !isMe(m) ? () => handleKick(m.userId) : null}
                                        onTransferHost={isHost && !isMe(m) ? () => handleTransferHost(m.userId) : null}
                                        onAddFriend={!isMe(m) && !isFriend(m) ? () => handleAddFriend(m) : null}
                                    />
                                ))
                            )}
                        </div>
                    </section>

                    {teamsEnabled && <TeamChannels groupId={groupId} isHost={isHost} />}

                    <LobbyFriendsPanel
                        groupId={groupId}
                        groupName={groupName || groupId}
                        onOpenChat={(f) => setChatFriend(f)}
                    />

                    <div className="px-3 py-2.5 border-t border-og flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleLeave}
                            disabled={leaving}
                            className="og-btn-danger w-full text-xs py-2">
                            {leaving ? t('lobby.leaving') : t('lobby.leaveLobby')}
                        </button>
                    </div>
                </div>

                <div dir={dir} className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 overflow-hidden">
                    <div className="og-panel flex-shrink-0 overflow-hidden">
                        <div className="px-4 py-3 border-b border-og">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <h2 className="og-title text-sm text-og-accent truncate">{groupName || groupId}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={connected ? 'status-online' : 'status-offline'} />
                                        <span className="text-og-muted text-[11px]">{connected ? t('lobby.connectedStatus') : t('lobby.disconnectedStatus')}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(groupId)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 2000)
                                    }}
                                    title={groupId}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold shrink-0 transition-colors ${
                                        copied
                                            ? 'text-og-success bg-og-subtle'
                                            : 'text-og-muted hover:text-og-accent hover:bg-og-hover'
                                    }`}>
                                    {copied ? <Icon icon={Check} size={12} /> : <Icon icon={Copy} size={12} />}
                                    {copied ? t('common.copied') : t('lobby.copyInvite')}
                                </button>
                            </div>
                        </div>

                        {hubReady && (
                            <GamePanel
                                lobbyId={groupId}
                                isHost={isHost}
                                hub={getLobbyHub()}
                                onMeshActive={(version) => {
                                    meshState.setMeshActive(true)
                                    if (version) meshState.setAppliedVersion(version)
                                }}
                                onGameStateChange={(game, playing) => setGameStateInfo({ game, playing })}
                            />
                        )}
                    </div>

                    {chatEnabled && <div className="og-panel flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                        <div className="og-lobby-col-head px-5 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <Icon icon={MessageCircle} size="md" className="text-og-accent shrink-0" />
                                <span className="og-title text-sm text-og-body shrink-0">{t('lobby.chatTitle')}</span>
                            </div>
                        </div>

                        <div
                            ref={messagesContainerRef}
                            className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="text-center py-12 text-og-muted text-sm opacity-60">
                                    {t('lobby.chatEmpty')}
                                </div>
                            )}
                            {messages.map(msg => (
                                <MessageBubble key={msg.id} msg={msg} currentUserId={user?.id?.toString()} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="min-h-[20px] px-4 flex items-center">
                            {typingUsers.length > 0 && (
                                <TypingIndicator users={typingUsers} />
                            )}
                        </div>

                        <div className="p-3 flex-shrink-0 relative no-drag">
                            {showEmoji && (
                                <EmojiPicker
                                    onSelect={(emoji) => setInput(prev => prev + emoji)}
                                    onClose={() => setShowEmoji(false)}
                                />
                            )}
                            <div className="flex gap-2 items-end">
                                <ChatTextarea
                                    className="og-input flex-1 min-w-0 py-2.5 no-drag"
                                    placeholder={t('lobby.chatPlaceholder')}
                                    value={input}
                                    onChange={(v) => {
                                        setInput(v)
                                        if (typingThrottle.current) return
                                        getLobbyHub()?.invoke('Typing', groupId).catch(() => {})
                                        typingThrottle.current = setTimeout(() => { typingThrottle.current = null }, 2000)
                                    }}
                                    onSend={sendMessage}
                                    maxLength={500}
                                    disabled={!connected}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowEmoji(s => !s)}
                                    disabled={!connected}
                                    className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${
                                        showEmoji
                                            ? 'border-og-primary bg-og-primary-dim text-og-accent'
                                            : 'border-og text-og-muted hover:text-og-accent hover:border-og-primary'
                                    }`}>
                                    <Icon icon={Smile} size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || !connected}
                                    className="og-btn-primary px-4 py-2.5 text-xs shrink-0">
                                    {t('common.send')}
                                </button>
                            </div>
                        </div>
                    </div>}
                </div>
            </div>

            {chatFriend && friendsChatEnabled && (
                <FloatingChat
                    key={chatFriend.friendId}
                    friend={chatFriend}
                    onClose={() => setChatFriend(null)}
                />
            )}

        </AppShell>
    )
}

function MemberRow({ member, isMe, isCurrentUserHost, isFriend, speaking, muted, gameInfo, onToggleMute, onKick, onTransferHost, onAddFriend }) {
    const { t } = useTranslation()
    const m = member
    const [showActions, setShowActions] = useState(false)
    const [adding, setAdding] = useState(false)
    const { channels, memberships } = useVoiceStore()

    const displayIp = gameInfo?.game?.gameType === 2 ? m.ip : m.tincIp

    const memberChannelId = memberships[m.userId]
    const memberChannel   = memberChannelId && memberChannelId !== 'lobby'
        ? channels.find(c => c.id === memberChannelId)
        : null

    async function handleAddClick() {
        if (!onAddFriend || adding) return
        setAdding(true)
        try {
            await onAddFriend()
        } finally {
            setAdding(false)
        }
    }

    return (
        <div
            className="flex items-center gap-2 py-2 border-b border-og last:border-b-0 group/row"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}>
            {/* Avatar */}
            <div className={`relative w-7 h-7 og-avatar-ring text-[11px] font-bold shrink-0 transition-all overflow-hidden ${
                speaking ? 'ring-2 ring-gn-green' : ''
            }`}>
                {m.avatarUrl
                    ? <img src={m.avatarUrl} className="w-full h-full object-cover" alt="" />
                    : (m.username || m.peerId || '?')[0].toUpperCase()
                }
                {/* Crown badge for host */}
                {m.isHost && (
                    <span className="absolute -top-1.5 -end-1.5 text-[9px]" title={t('lobby.hostBadge')}>
                        <Icon icon={Crown} size={10} className="text-yellow-400 drop-shadow-sm" />
                    </span>
                )}
            </div>

            {/* Name + IP */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-og-body text-xs font-medium truncate">
                        {m.username || (m.peerId ? `${m.peerId.substring(0, 10)}...` : '?')}
                    </span>
                    {isMe && <span className="text-og-accent text-[11px] shrink-0">{t('common.you')}</span>}
                </div>
                <div className="font-mono text-og-muted text-[10px] mt-0.5 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.connected ? 'bg-gn-green' : 'bg-gn-muted'}`} />
                    {displayIp
                        ? <span className="ltr">{displayIp}</span>
                        : <span>{m.connected ? t('lobby.connectedStatus') : t('lobby.disconnectedStatus')}</span>
                    }
                </div>
                {memberChannel && (
                    <div className="text-[9px] text-og-accent opacity-70 mt-0.5 truncate">
                        {memberChannel.name}
                    </div>
                )}
            </div>

            {/* Action buttons — only shown on hover or for admin */}
            <div className={`flex items-center gap-1 shrink-0 transition-opacity ${showActions || isCurrentUserHost ? 'opacity-100' : 'opacity-0'}`}>
                {/* Add friend — only for non-friends, non-self */}
                {onAddFriend && !isFriend && (
                    <button
                        type="button"
                        onClick={handleAddClick}
                        disabled={adding}
                        title={t('lobby.addFriend')}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-og-muted hover:text-og-accent hover:bg-og-primary-dim transition-colors no-drag disabled:opacity-40">
                        <Icon icon={UserPlus} size={13} />
                    </button>
                )}

                {/* Mute (local) — for all non-self members */}
                {!isMe && m.userId && (
                    <button
                        type="button"
                        onClick={onToggleMute}
                        title={muted ? t('lobby.unmute') : t('lobby.muteLocal')}
                        className={`flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-colors no-drag ${
                            muted
                                ? 'text-red-400 hover:bg-red-500/15'
                                : speaking
                                    ? 'text-gn-green animate-pulse'
                                    : 'text-og-muted hover:text-og-body hover:bg-og-hover'
                        }`}>
                        <Icon icon={muted ? VolumeX : Volume2} size={13} />
                    </button>
                )}

                {/* Transfer host — admin only, non-self */}
                {onTransferHost && !m.isHost && (
                    <button
                        type="button"
                        onClick={onTransferHost}
                        title={t('lobby.transferHost')}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-og-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors no-drag">
                        <Icon icon={Crown} size={12} />
                    </button>
                )}

                {/* Kick — admin only, non-self */}
                {onKick && (
                    <button
                        type="button"
                        onClick={onKick}
                        title={t('lobby.kick')}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-og-muted hover:text-red-400 hover:bg-red-500/10 transition-colors no-drag">
                        <Icon icon={UserX} size={13} />
                    </button>
                )}
            </div>
        </div>
    )
}

function TypingIndicator({ users }) {
    const { t } = useTranslation()
    const label = users.length === 1
        ? t('lobby.typingOne', { name: users[0].username })
        : t('lobby.typingMany', { count: users.length })
    return (
        <span className="flex items-center gap-1.5 text-og-muted text-xs">
            {label}
            <span className="flex gap-0.5 items-end pb-0.5">
                <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
        </span>
    )
}

function MessageBubble({ msg, currentUserId }) {
    const { i18n } = useTranslation()
    if (msg.system) {
        return (
            <div className="text-center">
                <span className="text-og-muted text-xs px-3 py-1 rounded-full bg-og-subtle">
                    {msg.message}
                </span>
            </div>
        )
    }

    const isMine = msg.senderId === currentUserId

    return (
        <div className={`flex gap-2 min-w-0 w-full animate-fade-in ${isMine ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 og-avatar-ring text-xs font-bold shrink-0 mt-0.5 overflow-hidden">
                {msg.senderAvatarUrl
                    ? <img src={msg.senderAvatarUrl} className="w-full h-full object-cover" alt="" />
                    : (msg.senderName || '?')[0].toUpperCase()
                }
            </div>
            <div className={`min-w-0 max-w-[calc(100%-2.25rem)] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && (
                    <span className="text-og-muted text-xs px-1">{msg.senderName}</span>
                )}
                <div
                    dir="auto"
                    className={`min-w-0 max-w-full px-3.5 py-2 rounded-xl text-sm selectable whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                        isMine ? 'bg-og-primary-dim text-og-body' : 'bg-og-subtle text-og-body'
                    }`}>
                    {msg.message}
                </div>
                <span className="text-og-muted text-[10px] px-1 opacity-70">
                    {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    )
}
