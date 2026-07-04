import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { messageAPI } from '../api'
import { useMessageStore } from '../store/messageStore'
import { usePresenceStore } from '../store/presenceStore'
import { useAuthStore } from '../store/authStore'
import { dayLabel, isNewDay } from '../utils/chatDate'
import EmojiPicker from './EmojiPicker'
import ChatTextarea from './ChatTextarea'
import Icon from './ui/Icon'

export default function FriendChat({ friend }) {
    const { t, i18n }             = useTranslation()
    const [input, setInput]       = useState('')
    const [loading, setLoading]   = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [hasMore, setHasMore]   = useState(true)
    const [showEmoji, setShowEmoji] = useState(false)
    const { user }                = useAuthStore()
    const { hub }                 = usePresenceStore()
    const { conversations, setConversation, prependMessages, clearUnread, dmTyping } = useMessageStore()
    const messagesRef             = useRef(null)
    const typingThrottle          = useRef(null)

    const isTyping = dmTyping[friend.friendId?.toString()]

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

    // اسکرول به پایین موقع پیام جدید (نه موقع لود قدیمی‌ها)
    const prevLenRef = useRef(0)
    useEffect(() => {
        const el = messagesRef.current
        if (!el) return
        const isNewMessage = messages.length > prevLenRef.current && !loadingOlder
        prevLenRef.current = messages.length
        if (isNewMessage) el.scrollTop = el.scrollHeight
    }, [messages, loadingOlder])

    // بعد از پایان لود اولیه، به پایین برو
    useEffect(() => {
        if (loading) return
        const el = messagesRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [loading])

    // لود پیام‌های قدیمی‌تر موقع اسکرول به بالا
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
                // حفظ موقعیت اسکرول بعد از اضافه شدن بالا
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight - prevHeight
                })
            }
            if (res.data.length < 30) setHasMore(false)
        } catch {}
        finally { setLoadingOlder(false) }
    }

    async function send() {
        const text = input.trim()
        if (!text || !hub) return
        try {
            await hub.invoke('SendDirectMessage', friend.friendId.toString(), text)
            setInput('')
        } catch (err) {
            console.error('DM error:', err)
        }
    }

    function handleSubmit(e) {
        e.preventDefault()
        send()
    }

    return (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-og flex-shrink-0">
                <div className="relative shrink-0">
                    <div className="w-9 h-9 og-avatar-ring text-sm font-bold overflow-hidden">
                        {friend.avatarUrl
                            ? <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="" />
                            : friend.username[0].toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--og-surface)] ${
                        friend.online ? 'bg-gn-green' : 'bg-gn-muted'
                    }`} />
                </div>
                <div className="min-w-0">
                    <div className="text-og-body text-sm font-semibold truncate">{friend.username}</div>
                    <div className="text-og-muted text-xs">{friend.online ? t('common.online') : t('common.offline')}</div>
                </div>
            </div>

            <div ref={messagesRef} onScroll={onScroll} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 space-y-3">
                {loadingOlder && (
                    <div className="flex justify-center py-1">
                        <div className="w-4 h-4 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin" />
                    </div>
                )}
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-og-muted text-sm">
                        {t('friendChat.startConversationWith', { username: friend.username })}
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMine = msg.senderId === myId
                        const showDay = isNewDay(messages[i - 1], msg)
                        return (
                            <div key={msg.id}>
                                {showDay && (
                                    <div className="flex items-center justify-center my-3">
                                        <span className="text-og-muted text-[11px] px-3 py-1 rounded-full bg-og-subtle">
                                            {dayLabel(msg.sentAt)}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex min-w-0 w-full ${isMine ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`min-w-0 max-w-[75%] px-3.5 py-2 text-sm rounded-xl ${
                                        isMine ? 'bg-og-primary-dim text-og-body' : 'bg-og-subtle text-og-body'
                                    }`}>
                                        <p dir="auto" className="leading-relaxed selectable whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">{msg.message}</p>
                                        <p className="text-og-muted text-[10px] mt-1 opacity-70" dir="ltr">
                                            {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="min-h-[20px] px-4 flex items-center">
                {isTyping && (
                    <span className="flex items-center gap-1.5 text-og-muted text-xs">
                        {t('friendChat.typing', { name: isTyping })}
                        <span className="flex gap-0.5 items-end pb-0.5">
                            <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 rounded-full bg-og-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                    </span>
                )}
            </div>

            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-og flex-shrink-0 relative no-drag">
                {showEmoji && (
                    <EmojiPicker
                        onSelect={(e) => setInput(prev => prev + e)}
                        onClose={() => setShowEmoji(false)}
                    />
                )}
                <div className="flex gap-2 items-end">
                    <ChatTextarea
                        className="og-input flex-1 py-2.5 no-drag"
                        placeholder={t('friendChat.placeholder')}
                        value={input}
                        onChange={(v) => {
                            setInput(v)
                            if (hub && !typingThrottle.current) {
                                hub.invoke('Typing', friend.friendId.toString()).catch(() => {})
                                typingThrottle.current = setTimeout(() => { typingThrottle.current = null }, 2000)
                            }
                        }}
                        onSend={send}
                        maxLength={1000}
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmoji(s => !s)}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                            showEmoji
                                ? 'bg-og-primary-dim text-og-accent'
                                : 'text-og-muted hover:bg-og-hover hover:text-og-accent'
                        }`}>
                        <Icon icon={Smile} size={18} />
                    </button>
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="og-btn-primary px-4 py-2.5 text-xs shrink-0">
                        {t('common.send')}
                    </button>
                </div>
            </form>
        </div>
    )
}