import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, X } from 'lucide-react'
import { notifAPI, friendAPI } from '../api'
import { usePresenceStore } from '../store/presenceStore'
import { useMessageStore } from '../store/messageStore'
import { useNotificationStore } from '../store/notificationStore'

import Icon from './ui/Icon'

export default function NotificationBell() {
    const [open, setOpen]       = useState(false)
    const [notifs, setNotifs]   = useState([])      // friend req/accepted از MongoDB
    const [loading, setLoading] = useState(false)
    const dropRef               = useRef(null)
    const navigate              = useNavigate()
    const { friends, setFriends } = usePresenceStore()
    const { unreadCounts }      = useMessageStore()
    const { toast }             = useNotificationStore()

    const msgSenders = Object.entries(unreadCounts).filter(([, c]) => c > 0)
    const totalCount = notifs.length + msgSenders.length

    useEffect(() => {
        loadNotifs()
        const interval = setInterval(loadNotifs, 30000)
        const handler  = () => loadNotifs()
        window.addEventListener('notif:new', handler)
        return () => {
            clearInterval(interval)
            window.removeEventListener('notif:new', handler)
        }
    }, [])

    useEffect(() => {
        function handleClick(e) {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    async function loadNotifs() {
        try {
            const res = await notifAPI.getUnread()
            setNotifs(res.data)
        } catch {}
    }

    async function handleOpen() {
        if (!open) {
            setLoading(true)
            await loadNotifs()
            setLoading(false)
        }
        setOpen(o => !o)
    }

    async function handleAccept(notif) {
        try {
            await friendAPI.respond(notif.referenceId, true)
            await notifAPI.markRead(notif.id)
            setNotifs(n => n.filter(x => x.id !== notif.id))
            toast(`${notif.fromUsername} به دوستان اضافه شد`, 'success')
            setFriends((await friendAPI.getAll()).data)
        } catch (e) {
            toast(e.response?.data?.message || 'خطا', 'error')
        }
    }

    async function handleReject(notif) {
        try {
            await friendAPI.respond(notif.referenceId, false)
            await notifAPI.markRead(notif.id)
            setNotifs(n => n.filter(x => x.id !== notif.id))
        } catch {}
    }

    async function handleMarkRead(notif) {
        try {
            await notifAPI.markRead(notif.id)
            setNotifs(n => n.filter(x => x.id !== notif.id))
        } catch {}
    }

    async function handleMarkAllRead() {
        try {
            await notifAPI.markAllRead()
            setNotifs([])
        } catch {}
    }

    function handleOpenChat(friendId) {
        setOpen(false)
        navigate('/friends', { state: { openChatWith: friendId } })
    }

    function friendName(friendId) {
        return friends.find(x => x.friendId?.toString() === friendId)?.username || 'کاربر'
    }

    return (
        <div className="relative no-drag" ref={dropRef}>
            {/* Bell button */}
            <button
                onClick={handleOpen}
                className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors">
                <Icon icon={Bell} size="sm" />
                {totalCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gn-red rounded-full flex items-center justify-center text-white text-xs font-bold leading-none">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-1rem)] bg-gn-surface border border-gn-border rounded-xl shadow-2xl z-[100] overflow-hidden animate-fade-in"
                     style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gn-border">
            <span className="font-semibold text-sm text-gn-text">
              اعلان‌ها
            </span>
                        {notifs.length > 0 && (
                            <button onClick={handleMarkAllRead}
                                    className="text-gn-muted hover:text-gn-accent text-xs transition-colors">
                                همه خوانده شد
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-gn-accent/30 border-t-gn-accent rounded-full animate-spin" />
                            </div>
                        ) : totalCount === 0 ? (
                            <div className="text-center py-8 text-gn-muted text-sm">
                                اعلانی وجود ندارد
                            </div>
                        ) : (
                            <>
                                {/* پیام‌های خونده‌نشده */}
                                {msgSenders.map(([friendId, count]) => (
                                    <div key={`msg-${friendId}`}
                                         className="px-4 py-3 border-b border-gn-border/50 hover:bg-gn-panel/50 transition-colors flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-gn-accent/20 border border-gn-accent/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-gn-accent text-xs font-bold">
                        {friendName(friendId)[0]?.toUpperCase()}
                      </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                      <span className="text-gn-text text-xs font-semibold">
                        {count === 1 ? 'پیام جدید' : `${count} پیام`} از {friendName(friendId)}
                      </span>
                                        </div>
                                        <button onClick={() => handleOpenChat(friendId)}
                                                className="px-3 py-1.5 text-xs bg-gn-accent text-gn-bg rounded hover:opacity-90 transition-opacity flex-shrink-0">
                                            مشاهده
                                        </button>
                                    </div>
                                ))}

                                {/* درخواست‌های دوستی */}
                                {notifs.map(n => (
                                    <NotifItem
                                        key={n.id}
                                        notif={n}
                                        onAccept={() => handleAccept(n)}
                                        onReject={() => handleReject(n)}
                                        onRead={() => handleMarkRead(n)}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function NotifItem({ notif, onAccept, onReject, onRead }) {
    // 1 = FriendRequest, 2 = FriendRequestAccepted
    if (notif.type === 1) {
        return (
            <div className="px-4 py-3 border-b border-gn-border/50 hover:bg-gn-panel/50 transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gn-accent2/20 border border-gn-accent2/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-gn-accent2 text-xs font-bold">{notif.fromUsername?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-gn-text text-xs font-semibold">{notif.fromUsername}</span>
                        <span className="text-gn-muted text-xs"> درخواست دوستی فرستاد</span>
                    </div>
                    <span className="text-gn-muted text-xs flex-shrink-0">
            {formatTime(notif.createdAt)}
          </span>
                </div>
                <div className="flex gap-2">
                    <button onClick={onAccept}
                            className="flex-1 py-1.5 text-xs bg-gn-accent2/80 text-white rounded hover:opacity-90 transition-opacity">
                        قبول
                    </button>
                    <button onClick={onReject}
                            className="flex-1 py-1.5 text-xs border border-gn-border text-gn-muted hover:text-gn-text rounded transition-colors">
                        رد
                    </button>
                </div>
            </div>
        )
    }

    if (notif.type === 2) {
        return (
            <div className="px-4 py-3 border-b border-gn-border/50 hover:bg-gn-panel/50 transition-colors flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gn-green/20 border border-gn-green/30 flex items-center justify-center flex-shrink-0">
                    <Icon icon={Check} size="xs" className="text-gn-green" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-gn-text text-xs font-semibold">{notif.fromUsername}</span>
                    <span className="text-gn-muted text-xs"> درخواست دوستی را قبول کرد</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gn-muted text-xs">{formatTime(notif.createdAt)}</span>
                    <button onClick={onRead} className="text-gn-muted hover:text-gn-text flex items-center justify-center w-5 h-5">
                        <Icon icon={X} size="xs" />
                    </button>
                </div>
            </div>
        )
    }

    return null
}

function formatTime(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60)   return 'همین الان'
    if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت`
    return `${Math.floor(diff / 86400)} روز`
}