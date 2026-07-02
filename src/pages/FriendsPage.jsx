import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, Search, X } from 'lucide-react'
import { friendAPI } from '../api'
import { usePresenceStore } from '../store/presenceStore'
import { useNotificationStore } from '../store/notificationStore'
import { useMessageStore } from '../store/messageStore'
import { useSettingStore } from '../store/settingStore'
import AppShell from '../components/AppShell'
import FriendChat from '../components/FriendChat'
import Icon from '../components/ui/Icon'

const TABS = [
    ['friends', (n) => `دوستان (${n})`],
    ['requests', () => 'درخواست‌ها'],
]

export default function FriendsPage() {
    const [tab, setTab]           = useState('friends')
    const [searchQ, setSearchQ]   = useState('')
    const [searchRes, setSearchRes] = useState([])
    const [requests, setRequests] = useState([])
    const [sending, setSending]   = useState(null)
    const { friends, setFriends } = usePresenceStore()
    const { toast }               = useNotificationStore()
    const location                = useLocation()
    const { unreadCounts }        = useMessageStore()
    const [selectedFriend, setSelectedFriend] = useState(null)
    const friendsChatEnabled = useSettingStore(s => s.adminSettings['friends.chat.enabled']) !== 'false'

    useEffect(() => {
        if (tab === 'requests') loadRequests()
    }, [tab])

    useEffect(() => {
        const chatWith = location.state?.openChatWith
        if (chatWith && friends.length > 0) {
            const f = friends.find(x => x.friendId?.toString() === chatWith.toString())
            if (f) {
                setTab('friends')
                setSelectedFriend(f)
            }
        }
    }, [location.state, friends])

    async function loadRequests() {
        try {
            const res = await friendAPI.getRequests()
            setRequests(res.data)
        } catch (e) {
            if (e.response) toast(e.response.data?.message || 'خطا در دریافت درخواست‌ها', 'error')
        }
    }

    async function handleSearch() {
        if (searchQ.length < 2) return
        try {
            const res = await friendAPI.search(searchQ)
            setSearchRes(res.data)
        } catch (e) {
            if (e.response) toast(e.response.data?.message || 'خطا در جستجو', 'error')
        }
    }

    async function handleSendRequest(username) {
        setSending(username)
        try {
            await friendAPI.sendRequest(username)
            toast('درخواست دوستی ارسال شد', 'success')
        } catch (e) {
            toast(e.response?.data?.message || 'خطا در ارسال درخواست', 'error')
        } finally {
            setSending(null)
        }
    }

    async function handleRespond(requestId, accept) {
        try {
            await friendAPI.respond(requestId, accept)
            toast(accept ? 'دوست اضافه شد' : 'درخواست رد شد', accept ? 'success' : 'info')
            loadRequests()
            const res = await friendAPI.getAll()
            setFriends(res.data)
        } catch (e) {
            toast(e.response?.data?.message || 'خطا در پاسخ به درخواست', 'error')
        }
    }

    function clearSearch() {
        setSearchQ('')
        setSearchRes([])
    }

    async function handleRemove(friendId, username) {
        try {
            await friendAPI.remove(friendId)
            toast(`${username} از لیست دوستان حذف شد`, 'info')
            const res = await friendAPI.getAll()
            setFriends(res.data)
        } catch (e) {
            toast(e.response?.data?.message || 'خطا در حذف دوست', 'error')
        }
    }

    const onlineFriends  = friends.filter(f => f.online)
    const offlineFriends = friends.filter(f => !f.online)

    return (
        <AppShell>
            <div className="flex flex-col flex-1 min-h-0 min-w-0 og-panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-og flex-shrink-0">
                    <div>
                        <p className="og-label text-og-muted">پیام و شبکه</p>
                        <h2 className="og-title text-xl text-og-accent">دوستان</h2>
                    </div>
                    <div className="flex gap-1 p-1 rounded-lg bg-og-tab">
                        {TABS.map(([key, labelFn]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => { setTab(key); setSelectedFriend(null) }}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                    tab === key ? 'og-tab-active' : 'og-tab-inactive hover:text-og-body'
                                }`}>
                                {labelFn(friends.length)}
                            </button>
                        ))}
                    </div>
                </header>

                {tab === 'friends' ? (
                    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
                        <aside className={`w-72 shrink-0 min-h-0 flex flex-col ${selectedFriend && friendsChatEnabled ? 'border-e border-og' : ''}`}>
                            {/* Search bar */}
                            <div className="px-2 pt-3 pb-2 shrink-0">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Icon icon={Search} size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-og-muted pointer-events-none" />
                                        <input
                                            className="og-input w-full pr-8 text-xs py-1.5"
                                            placeholder="جستجوی کاربر..."
                                            value={searchQ}
                                            onChange={e => setSearchQ(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    {searchRes.length > 0 ? (
                                        <button type="button" onClick={clearSearch} className="og-btn-ghost px-2.5 py-1.5 text-xs shrink-0">
                                            <Icon icon={X} size={14} />
                                        </button>
                                    ) : (
                                        <button type="button" onClick={handleSearch} className="og-btn-primary px-3 py-1.5 text-xs shrink-0">جستجو</button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto py-1 px-2">
                                {searchRes.length > 0 ? (
                                    <div className="space-y-0.5">
                                        {searchRes.map(u => (
                                            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-og-hover transition-colors">
                                                <div className="w-9 h-9 og-avatar-ring text-sm font-bold shrink-0 overflow-hidden">
                                                    {u.avatarUrl
                                                        ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt="" />
                                                        : u.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0 text-og-body text-sm truncate">{u.username}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendRequest(u.username)}
                                                    disabled={sending === u.username}
                                                    className="og-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40 shrink-0">
                                                    {sending === u.username ? '...' : '+ افزودن'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {onlineFriends.length > 0 && (
                                            <FriendSection title={`آنلاین · ${onlineFriends.length}`}>
                                                {onlineFriends.map(f => (
                                                    <FriendRow
                                                        key={f.friendId}
                                                        friend={f}
                                                        onRemove={handleRemove}
                                                        onChat={friendsChatEnabled ? () => setSelectedFriend(f) : null}
                                                        isSelected={friendsChatEnabled && selectedFriend?.friendId === f.friendId}
                                                        unread={friendsChatEnabled ? (unreadCounts[f.friendId] || 0) : 0}
                                                    />
                                                ))}
                                            </FriendSection>
                                        )}
                                        {offlineFriends.length > 0 && (
                                            <FriendSection title={`آفلاین · ${offlineFriends.length}`}>
                                                {offlineFriends.map(f => (
                                                    <FriendRow
                                                        key={f.friendId}
                                                        friend={f}
                                                        onRemove={handleRemove}
                                                        onChat={friendsChatEnabled ? () => setSelectedFriend(f) : null}
                                                        isSelected={friendsChatEnabled && selectedFriend?.friendId === f.friendId}
                                                        unread={friendsChatEnabled ? (unreadCounts[f.friendId] || 0) : 0}
                                                    />
                                                ))}
                                            </FriendSection>
                                        )}
                                        {friends.length === 0 && (
                                            <p className="text-center py-12 text-og-muted text-sm">هنوز دوستی اضافه نکردید</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </aside>

                        {friendsChatEnabled && selectedFriend ? (
                            <FriendChat key={selectedFriend.friendId} friend={selectedFriend} />
                        ) : (
                            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-og-muted">
                                <Icon icon={MessageCircle} size="xl" className="opacity-25" />
                                <p className="text-sm">
                                    {friendsChatEnabled
                                        ? 'یک دوست را انتخاب کن تا گفتگو شروع شود'
                                        : 'چت در حال حاضر غیرفعال است'}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                        {tab === 'requests' && (
                            <div className="max-w-xl space-y-1">
                                {requests.length === 0 ? (
                                    <p className="text-center py-16 text-og-muted text-sm">درخواستی وجود ندارد</p>
                                ) : requests.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-og-hover transition-colors">
                                        <div className="w-9 h-9 og-avatar-ring text-sm font-bold shrink-0">
                                            {r.from[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-og-body text-sm font-semibold">{r.from}</div>
                                            <div className="text-og-muted text-xs">درخواست دوستی</div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button type="button" onClick={() => handleRespond(r.id, true)} className="og-btn-primary px-3 py-1.5 text-xs">قبول</button>
                                            <button type="button" onClick={() => handleRespond(r.id, false)} className="og-btn-ghost px-3 py-1.5 text-xs">رد</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                )}
            </div>
        </AppShell>
    )
}

function FriendSection({ title, children }) {
    return (
        <div className="mb-4 last:mb-0">
            <p className="og-label text-og-muted px-2 mb-1.5">{title}</p>
            <div className="space-y-0.5">{children}</div>
        </div>
    )
}

function FriendRow({ friend, onRemove, onChat, isSelected, unread }) {
    return (
        <div
            role={onChat ? 'button' : undefined}
            tabIndex={onChat ? 0 : undefined}
            onClick={onChat ?? undefined}
            onKeyDown={onChat ? (e => e.key === 'Enter' && onChat()) : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${onChat ? 'cursor-pointer' : ''} ${
                isSelected ? 'bg-og-primary-dim text-og-accent' : 'hover:bg-og-hover'
            }`}>
            <div className="relative shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden ${
                    isSelected ? 'og-avatar-ring' : 'bg-og-subtle text-og-body'
                }`}>
                    {friend.avatarUrl
                        ? <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="" />
                        : friend.username[0].toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--og-surface)] ${
                    friend.online ? 'bg-gn-green' : 'bg-gn-muted'
                }`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-og-body">{friend.username}</div>
                <div className="text-og-muted text-xs">{friend.online ? 'آنلاین' : 'آفلاین'}</div>
            </div>

            {unread > 0 && (
                <span className="min-w-5 h-5 px-1.5 bg-og-primary rounded-full flex items-center justify-center text-og-badge text-xs font-bold shrink-0">
                    {unread > 9 ? '9+' : unread}
                </span>
            )}

            <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(friend.friendId, friend.username) }}
                className="opacity-0 group-hover:opacity-100 text-og-muted hover:text-og-danger text-xs transition-opacity px-2 py-1 shrink-0">
                حذف
            </button>
        </div>
    )
}
