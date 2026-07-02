import { useState } from 'react'
import { MessageCircle, Search, UserPlus, X } from 'lucide-react'
import { friendAPI } from '../api'
import { usePresenceStore } from '../store/presenceStore'
import { useMessageStore } from '../store/messageStore'
import { useNotificationStore } from '../store/notificationStore'
import Icon from './ui/Icon'

export default function LobbyFriendsPanel({ groupId, groupName, onOpenChat }) {
    const [showAdd, setShowAdd]       = useState(false)
    const [showOffline, setShowOffline] = useState(false)
    const [searchQ, setSearchQ]       = useState('')
    const [searchRes, setSearchRes]   = useState([])
    const [inviting, setInviting]     = useState(null)
    const [sending, setSending]       = useState(null)
    const { friends }                 = usePresenceStore()
    const { unreadCounts }            = useMessageStore()
    const { toast }                   = useNotificationStore()

    const onlineFriends  = friends.filter(f => f.online)
    const offlineFriends = friends.filter(f => !f.online)
    const hasFriends     = friends.length > 0
    const hasOnline      = onlineFriends.length > 0
    const hasOffline     = offlineFriends.length > 0

    async function handleInvite(friend) {
        setInviting(friend.friendId)
        try {
            await friendAPI.invite(friend.friendId, groupId, groupName)
            toast(`دعوت به ${friend.username} ارسال شد`, 'success')
        } catch (e) {
            toast(e.response?.data?.message || 'خطا در دعوت', 'error')
        } finally {
            setInviting(null)
        }
    }

    async function handleSearch() {
        if (searchQ.length < 2) return
        try {
            setSearchRes((await friendAPI.search(searchQ)).data)
        } catch {}
    }

    async function handleAddFriend(username) {
        setSending(username)
        try {
            await friendAPI.sendRequest(username)
            toast('درخواست دوستی ارسال شد', 'success')
        } catch (e) {
            toast(e.response?.data?.message || 'خطا', 'error')
        } finally {
            setSending(null)
        }
    }

    function closeAdd() {
        setShowAdd(false)
        setSearchQ('')
        setSearchRes([])
    }

    const listMaxH = hasOnline
        ? 'max-h-36'
        : showOffline
            ? 'max-h-28'
            : ''

    return (
        <div className="flex flex-col shrink-0 bg-og-subtle/30">
            <div className="flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0">
                <p className="og-label text-og-muted truncate">
                    دعوت دوستان
                    {hasOnline && (
                        <span className="text-og-body font-normal mr-1">· {onlineFriends.length} آنلاین</span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => (showAdd ? closeAdd() : setShowAdd(true))}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold shrink-0 transition-colors ${
                        showAdd
                            ? 'og-tab-active'
                            : 'text-og-muted hover:text-og-body hover:bg-og-hover'
                    }`}>
                    {showAdd ? (
                        <>
                            <Icon icon={X} size={12} />
                            بستن
                        </>
                    ) : (
                        <>
                            <Icon icon={Search} size={12} />
                            افزودن
                        </>
                    )}
                </button>
            </div>

            {showAdd && (
                <div className="px-3 pb-2 flex-shrink-0 no-drag">
                    <div className="flex gap-2">
                        <input
                            className="og-input flex-1 py-1.5 text-xs no-drag"
                            placeholder="نام کاربری برای جستجو..."
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            autoFocus
                        />
                        <button type="button" onClick={handleSearch} className="og-btn-primary px-3 py-1.5 text-xs shrink-0">
                            جستجو
                        </button>
                    </div>
                    {searchRes.length > 0 && (
                        <div className="mt-2 max-h-24 overflow-y-auto overscroll-contain space-y-0.5">
                            {searchRes.map(u => (
                                <div key={u.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-og-hover">
                                    <div className="w-7 h-7 og-avatar-ring text-[11px] font-bold shrink-0 overflow-hidden">
                                        {u.avatarUrl
                                            ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt="" />
                                            : u.username[0].toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-og-body text-xs truncate">{u.username}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleAddFriend(u.username)}
                                        disabled={sending === u.username}
                                        className="og-btn-ghost px-2 py-1 text-[11px] shrink-0 disabled:opacity-40">
                                        {sending === u.username ? '...' : 'درخواست'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!showAdd && !hasFriends && (
                <p className="px-3 pb-3 text-og-muted text-[11px] leading-relaxed">
                    دوستی ندارید — با «افزودن» جستجو کنید و دعوت کنید.
                </p>
            )}

            {!showAdd && hasFriends && !hasOnline && (
                <p className="px-3 pb-1 text-og-muted text-[11px]">
                    کسی آنلاین نیست
                    {hasOffline && (
                        <>
                            {' · '}
                            <button
                                type="button"
                                onClick={() => setShowOffline(s => !s)}
                                className="text-og-accent hover:underline">
                                {showOffline ? 'پنهان' : `${offlineFriends.length} نفر آفلاین`}
                            </button>
                        </>
                    )}
                </p>
            )}

            {!showAdd && hasOnline && (
                <div className={`overflow-y-auto overscroll-contain px-3 pb-2 space-y-0.5 ${listMaxH}`}>
                    {onlineFriends.map(f => (
                        <FriendRow
                            key={f.friendId}
                            friend={f}
                            unread={unreadCounts[f.friendId]}
                            inviting={inviting === f.friendId}
                            onInvite={() => handleInvite(f)}
                            onChat={() => onOpenChat(f)}
                            canInvite
                        />
                    ))}
                </div>
            )}

            {!showAdd && hasOnline && hasOffline && (
                <div className="px-3 pb-1">
                    <button
                        type="button"
                        onClick={() => setShowOffline(s => !s)}
                        className="text-[10px] text-og-muted hover:text-og-body transition-colors">
                        {showOffline ? '▾ پنهان آفلاین‌ها' : `▸ ${offlineFriends.length} نفر آفلاین`}
                    </button>
                </div>
            )}

            {!showAdd && showOffline && hasOffline && (
                <div className={`overflow-y-auto overscroll-contain px-3 pb-3 space-y-0.5 ${hasOnline ? 'max-h-24' : listMaxH}`}>
                    {offlineFriends.map(f => (
                        <FriendRow
                            key={f.friendId}
                            friend={f}
                            unread={unreadCounts[f.friendId]}
                            onChat={() => onOpenChat(f)}
                            dimmed
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function FriendRow({ friend, unread, inviting, onInvite, onChat, canInvite, dimmed }) {
    return (
        <div
            className={`flex items-center gap-2 py-1.5 px-1 rounded-lg transition-colors group ${
                dimmed ? 'opacity-50' : 'hover:bg-og-hover'
            }`}>
            <div className="relative shrink-0">
                <div className="w-7 h-7 og-avatar-ring text-[11px] font-bold overflow-hidden">
                    {friend.avatarUrl
                        ? <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="" />
                        : friend.username[0].toUpperCase()}
                </div>
                {canInvite && (
                    <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-gn-green border-2 border-[var(--og-surface)]" />
                )}
            </div>
            <span className="flex-1 text-og-body text-xs truncate">{friend.username}</span>

            {unread > 0 && (
                <span className="min-w-4 h-4 px-1 bg-og-primary rounded-full flex items-center justify-center text-og-badge text-[10px] font-bold shrink-0">
                    {unread}
                </span>
            )}

            {canInvite && (
                <button
                    type="button"
                    onClick={onInvite}
                    disabled={inviting}
                    title="دعوت به لابی"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-og-accent bg-og-primary-dim/40 hover:bg-og-primary-dim transition-colors shrink-0 disabled:opacity-40">
                    <Icon icon={UserPlus} size="sm" />
                </button>
            )}

            <button
                type="button"
                onClick={onChat}
                title="پیام"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-og-muted hover:text-og-accent hover:bg-og-primary-dim transition-colors shrink-0">
                <Icon icon={MessageCircle} size="xs" />
            </button>
        </div>
    )
}
