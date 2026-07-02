import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Volume2, VolumeX, X, MessageCircle } from 'lucide-react'
import { useOverlayStore } from '../store/overlayStore'
import { useVoiceStore } from '../store/voiceStore'
import { usePresenceStore } from '../store/presenceStore'
import VoiceControls from './VoiceControls'
import StreamButton from './StreamButton'
import ChatTextarea from './ChatTextarea'
import Icon from './ui/Icon'

/**
 * مدال overlay داخل بازی (Ctrl+~).
 * بک‌دراپ تیره (کلیک = بستن). مدال: 30vw عرض، 90vh ارتفاع، marginTop 5vh.
 * ۳ بخش: هدر (اطلاعات لابی) / میدل (اعضا + mute + استریم) / فوتر (چت + دوستان آنلاین)
 */
export default function GameOverlay({
                                        groupId, groupName, members, myIp, user,
                                        messages, input, setInput, sendMessage, connected,
                                        selectedGame,
                                    }) {
    const { overlayMode, setOverlayMode } = useOverlayStore()
    const { speakingIds, mutedIds, toggleMuteUser } = useVoiceStore()
    const { friends } = usePresenceStore()

    // Esc هم ببنده
    useEffect(() => {
        if (!overlayMode) return
        const onKey = (e) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [overlayMode])

    if (!overlayMode) return null

    function close() {
        setOverlayMode(false)
        window.electron?.shortcut?.closeOverlay()  // به main خبر بده (برگرد به بازی)
    }

    function isMe(m) {
        return m.userId === user?.id?.toString() || m.peerId === user?.netbirdPeerId
    }

    const onlineFriends = friends.filter(f => f.online)

    return createPortal(
        // بک‌دراپ — کلیک بیرون = بستن
        <div
            onClick={close}
            className="fixed inset-0 z-[9999] flex visible"
            style={{ visibility: 'visible' }}>
            {/* مدال — کل پنجره رو پر می‌کنه */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col overflow-hidden w-full h-full no-drag"
                style={{
                    background: 'rgba(12,14,20,0.7)',
                    backdropFilter: 'blur(16px)',
                }}>

                {/* ── هدر: اطلاعات لابی ── */}
                <div className="px-4 py-3 border-b border-og flex items-center justify-between shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="og-title text-sm text-og-accent truncate">{groupName || groupId}</h2>
                            <span className={connected ? 'status-online' : 'status-offline'} />
                        </div>
                        {myIp && <div className="font-mono text-og-muted text-[11px] mt-0.5">{myIp}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-og-muted hover:text-og-body hover:bg-og-hover transition-colors shrink-0">
                        <Icon icon={X} size="sm" />
                    </button>
                </div>

                {/* ── میدل: اعضا + mute + استریم (اسکرول) ── */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <p className="og-label text-og-muted">اعضا ({members.length})</p>
                        <VoiceControls groupId={groupId} userId={user?.id?.toString()} />
                    </div>

                    <div className="space-y-1">
                        {members.map((m, i) => {
                            const mine = isMe(m)
                            const speaking = speakingIds.includes(m.userId)
                            const muted = mutedIds.includes(m.userId)
                            return (
                                <div key={m.peerId || m.userId || i} className="flex items-center gap-2 py-2 border-b border-og last:border-b-0">
                                    <div className={`w-7 h-7 og-avatar-ring text-xs font-bold shrink-0 overflow-hidden ${speaking ? 'ring-2 ring-gn-green' : ''}`}>
                                        {m.avatarUrl
                                            ? <img src={m.avatarUrl} className="w-full h-full object-cover" alt="" />
                                            : (m.username || m.peerId || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                    <span className="text-og-body text-xs font-medium truncate">
                      {m.username || (m.peerId ? `${m.peerId.substring(0, 8)}...` : '?')}
                    </span>
                                        {mine && <span className="text-og-accent text-[10px] mr-1">شما</span>}
                                    </div>
                                    {!mine && m.userId && (
                                        <button
                                            type="button"
                                            onClick={() => toggleMuteUser(m.userId)}
                                            title={muted ? 'صدا وصل' : 'صدا قطع (برای شما)'}
                                            className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-colors ${
                                                muted ? 'text-red-400 hover:bg-red-500/15'
                                                    : speaking ? 'text-gn-green animate-pulse'
                                                        : 'text-og-muted hover:text-og-body hover:bg-og-hover'
                                            }`}>
                                            {muted ? (
                                                <Icon icon={VolumeX} size={13} />
                                            ) : (
                                                <Icon icon={Volume2} size={13} />
                                            )}
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* دکمه استریم */}
                    {selectedGame && (
                        <div className="mt-3">
                            <StreamButton exeName={selectedGame.exeName} />
                        </div>
                    )}
                </div>

                {/* ── فوتر: چت (راست) + دوستان آنلاین (چپ) ── */}
                <div className="shrink-0 border-t border-og flex" style={{ height: '48%' }}>
                    {/* دوستان آنلاین — چپ */}
                    <div className="w-1/3 min-w-0 border-l border-og flex flex-col overflow-hidden">
                        <div className="px-3 py-2 border-b border-og shrink-0">
                            <span className="og-label text-og-muted text-[11px]">دوستان آنلاین</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1">
                            {onlineFriends.length === 0 ? (
                                <div className="text-center text-og-muted text-[11px] py-3 opacity-60">کسی آنلاین نیست</div>
                            ) : onlineFriends.map(f => (
                                <div key={f.friendId} className="flex items-center gap-1.5 py-1">
                                    <div className="w-6 h-6 og-avatar-ring text-[10px] font-bold shrink-0 overflow-hidden">
                                        {f.avatarUrl
                                            ? <img src={f.avatarUrl} className="w-full h-full object-cover" alt="" />
                                            : (f.username || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="text-og-body text-[11px] truncate flex-1">{f.username}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-gn-green shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* چت — راست */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        <div className="px-3 py-2 border-b border-og shrink-0 flex items-center gap-1.5">
                            <Icon icon={MessageCircle} size="xs" className="text-og-accent shrink-0" />
                            <span className="og-label text-og-muted text-[11px]">چت لابی</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
                            {messages.length === 0 ? (
                                <div className="text-center text-og-muted text-[11px] py-4 opacity-60">پیامی نیست</div>
                            ) : messages.slice(-30).map(msg => (
                                msg.system ? (
                                    <div key={msg.id} className="text-center">
                                        <span className="text-og-muted text-[10px]">{msg.message}</span>
                                    </div>
                                ) : (
                                    <div key={msg.id} className="flex flex-col">
                                        <span className="text-og-muted text-[10px]">{msg.senderName}</span>
                                        <span className="text-og-body text-xs break-words whitespace-pre-wrap">{msg.message}</span>
                                    </div>
                                )
                            ))}
                        </div>
                        <div className="p-2 border-t border-og shrink-0">
                            <div className="flex gap-1.5 items-end">
                                <ChatTextarea
                                    className="og-input flex-1 min-w-0 py-1.5 text-xs"
                                    placeholder="پیام..."
                                    value={input}
                                    onChange={setInput}
                                    onSend={sendMessage}
                                    maxLength={500}
                                    disabled={!connected}
                                />
                                <button
                                    type="button"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || !connected}
                                    className="og-btn-primary px-3 py-1.5 text-xs shrink-0">
                                    ارسال
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}