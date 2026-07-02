import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Send, Smile, X } from 'lucide-react'
import { messageAPI } from '../api'
import { useMessageStore } from '../store/messageStore'
import { usePresenceStore } from '../store/presenceStore'
import { useAuthStore } from '../store/authStore'
import { dayLabel, isNewDay } from '../utils/chatDate'
import EmojiPicker from './EmojiPicker'
import ChatTextarea from './ChatTextarea'
import Icon from './ui/Icon'

// پنجره چت شناور (گوشه پایین چپ) — برای استفاده داخل لابی
export default function FloatingChat({ friend, onClose }) {
    const [input, setInput]       = useState('')
    const [loading, setLoading]   = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [hasMore, setHasMore]   = useState(true)
    const [minimized, setMinimized] = useState(false)
    const [showEmoji, setShowEmoji] = useState(false)
    const { user }                = useAuthStore()
    const { hub }                 = usePresenceStore()
    const { conversations, setConversation, prependMessages, clearUnread } = useMessageStore()
    const endRef                  = useRef(null)
    const listRef                 = useRef(null)

    const messages = conversations[friend.friendId] || []
    const myId = user?.id?.toString()

    useEffect(() => {
        window.__activeChatFriendId = friend.friendId?.toString()
        return () => { window.__activeChatFriendId = null }
    }, [friend.friendId])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setHasMore(true)
        messageAPI.getHistory(friend.friendId)
            .then(res => {
                if (cancelled) return
                setConversation(friend.friendId, res.data)
                setHasMore(res.data.length >= 30)
                clearUnread(friend.friendId)
                hub?.invoke('MarkConversationRead', friend.friendId.toString()).catch(() => {})
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [friend.friendId])

    const prevLenRef = useRef(0)
    useEffect(() => {
        if (minimized) return
        const isNewMessage = messages.length > prevLenRef.current && !loadingOlder
        prevLenRef.current = messages.length
        if (isNewMessage) endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, minimized, loadingOlder])

    useEffect(() => {
        if (loading || minimized) return
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [loading, minimized])

    async function onScroll(e) {
        const el = e.target
        if (el.scrollTop > 40 || loadingOlder || !hasMore || messages.length === 0) return

        setLoadingOlder(true)
        const oldest = messages[0]
        const prevHeight = el.scrollHeight
        try {
            const res = await messageAPI.getHistory(friend.friendId, oldest.sentAt)
            if (res.data.length > 0) {
                prependMessages(friend.friendId, res.data)
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight - prevHeight
                })
            }
            if (res.data.length < 30) setHasMore(false)
        } catch {}
        finally { setLoadingOlder(false) }
    }

    async function send() {
        if (!input.trim() || !hub) return
        try {
            await hub.invoke('SendDirectMessage', friend.friendId.toString(), input.trim())
            setInput('')
        } catch {}
    }

    return (
        <div className="fixed bottom-0 left-4 z-40 w-72 bg-gn-surface border border-gn-border rounded-t-xl shadow-2xl flex flex-col"
             style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', maxHeight: minimized ? '44px' : '420px' }}>

            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gn-border cursor-pointer flex-shrink-0"
                 onClick={() => setMinimized(m => !m)}>
                <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 og-avatar-ring text-xs font-bold shrink-0 overflow-hidden">
                        {friend.avatarUrl
                            ? <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="" />
                            : <span className="text-gn-text text-xs font-bold">{friend.username[0].toUpperCase()}</span>}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gn-bg
            ${friend.online ? 'bg-gn-green' : 'bg-gn-muted'}`} />
                </div>
                <span className="flex-1 text-gn-text text-sm font-semibold truncate">{friend.username}</span>
                <button onClick={(e) => { e.stopPropagation(); setMinimized(m => !m) }}
                        className="text-gn-muted hover:text-gn-text w-5 h-5 flex items-center justify-center">
                    <Icon icon={minimized ? ChevronUp : ChevronDown} size="xs" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onClose() }}
                        className="text-gn-muted hover:text-gn-red w-5 h-5 flex items-center justify-center">
                    <Icon icon={X} size="xs" />
                </button>
            </div>

            {!minimized && (
                <>
                    <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: '240px' }}>
                        {loadingOlder && (
                            <div className="flex justify-center py-1">
                                <div className="w-4 h-4 border-2 border-gn-accent/30 border-t-gn-accent rounded-full animate-spin" />
                            </div>
                        )}
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-5 h-5 border-2 border-gn-accent/30 border-t-gn-accent rounded-full animate-spin" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gn-muted text-xs opacity-50">
                                شروع گفتگو
                            </div>
                        ) : messages.map((msg, i) => {
                            const isMine = msg.senderId === myId
                            const showDay = isNewDay(messages[i - 1], msg)
                            return (
                                <div key={msg.id}>
                                    {showDay && (
                                        <div className="flex items-center justify-center my-2">
                                            <span className="text-gn-muted text-[10px] px-2.5 py-0.5 rounded-full bg-gn-panel">
                                                {dayLabel(msg.sentAt)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs selectable whitespace-pre-wrap break-words ${
                                            isMine
                                                ? 'bg-gn-accent/20 border border-gn-accent/30 text-gn-text'
                                                : 'bg-gn-panel border border-gn-border text-gn-text'
                                        }`}>
                                            {msg.message}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={endRef} />
                    </div>

                    <div className="p-2 border-t border-gn-border flex-shrink-0 relative">
                        {showEmoji && (
                            <EmojiPicker
                                onSelect={(e) => setInput(p => p + e)}
                                onClose={() => setShowEmoji(false)}
                            />
                        )}
                        <div className="flex gap-1.5 items-end">
                            <ChatTextarea
                                className="gn-input flex-1 py-2 text-xs"
                                placeholder="پیام..."
                                value={input}
                                onChange={setInput}
                                onSend={send}
                                maxLength={1000}
                            />
                            <button onClick={() => setShowEmoji(s => !s)}
                                    className={`w-8 h-8 flex items-center justify-center rounded border flex-shrink-0 transition-colors ${
                                        showEmoji
                                            ? 'border-gn-accent text-gn-accent bg-gn-accent/10'
                                            : 'border-gn-border text-gn-muted hover:text-gn-accent'
                                    }`}>
                                <Icon icon={Smile} size="sm" />
                            </button>
                            <button onClick={send} disabled={!input.trim()}
                                    className="gn-btn-primary px-3 py-2 text-xs disabled:opacity-40 flex items-center justify-center">
                                <Icon icon={Send} size="sm" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
