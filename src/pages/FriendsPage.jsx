import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Search, X } from 'lucide-react'
import { friendAPI } from '../api'
import { usePresenceStore } from '../store/presenceStore'
import { useNotificationStore } from '../store/notificationStore'
import { useMessageStore } from '../store/messageStore'
import { useSettingStore } from '../store/settingStore'
import AppShell from '../components/AppShell'
import FriendChat from '../components/FriendChat'
import Icon from '../components/ui/Icon'

export default function FriendsPage() {
    const { t }                   = useTranslation()
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

    const TABS = [
        ['friends', (n) => t('friends.tabFriends', { count: n })],
        ['requests', () => t('friends.tabRequests')],
    ]

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
            if (e.response) toast(e.response.data?.message || t('friends.loadRequestsError'), 'error')
        }
    }

    async function handleSearch() {
        if (searchQ.length < 2) return
        try {
            const res = await friendAPI.search(searchQ)
            setSearchRes(res.data)
        } catch (e) {
            if (e.response) toast(e.response.data?.message || t('friends.searchError'), 'error')
        }
    }

    async function handleSendRequest(username) {
        setSending(username)
        try {
            await friendAPI.sendRequest(username)
            toast(t('friends.requestSent'), 'success')
        } catch (e) {
            toast(e.response?.data?.message || t('friends.requestSendError'), 'error')
        } finally {
            setSending(null)
        }
    }

    async function handleRespond(requestId, accept) {
        try {
            await friendAPI.respond(requestId, accept)
            toast(accept ? t('friends.friendAdded') : t('friends.requestRejected'), accept ? 'success' : 'info')
            loadRequests()
            const res = await friendAPI.getAll()
            setFriends(res.data)
        } catch (e) {
            toast(e.response?.data?.message || t('friends.respondError'), 'error')
        }
    }

    function clearSearch() {
        setSearchQ('')
        setSearchRes([])
    }

    async function handleRemove(friendId, username) {
        try {
            await friendAPI.remove(friendId)
            toast(t('friends.removedFromList', { username }), 'info')
            const res = await friendAPI.getAll()
            setFriends(res.data)
        } catch (e) {
            toast(e.response?.data?.message || t('friends.removeError'), 'error')
        }
    }

    const onlineFriends  = friends.filter(f => f.online)
    const offlineFriends = friends.filter(f => !f.online)

    return (
        <AppShell>
            <div className="flex flex-col flex-1 min-h-0 min-w-0 og-panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-og flex-shrink-0">
                    <div>
                        <p className="og-label text-og-muted">{t('friends.headerLabel')}</p>
                        <h2 className="og-title text-xl text-og-accent">{t('friends.headerTitle')}</h2>
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
                                        <Icon icon={Search} size={14} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-og-muted pointer-events-none" />
                                        <input
                                            className="og-input w-full pe-8 text-xs py-1.5"
                                            placeholder={t('friends.searchPlaceholder')}
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
                                        <button type="button" onClick={handleSearch} className="og-btn-primary px-3 py-1.5 text-xs shrink-0">{t('common.search')}</button>
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
                                                    {sending === u.username ? '...' : t('friends.add')}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {onlineFriends.length > 0 && (
                                            <FriendSection title={t('friends.onlineCount', { count: onlineFriends.length })}>
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
                                            <FriendSection title={t('friends.offlineCount', { count: offlineFriends.length })}>
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
                                            <p className="text-center py-12 text-og-muted text-sm">{t('friends.noFriendsYet')}</p>
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
                                        ? t('friends.selectFriendPrompt')
                                        : t('friends.chatDisabled')}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                        {tab === 'requests' && (
                            <div className="max-w-xl space-y-1">
                                {requests.length === 0 ? (
                                    <p className="text-center py-16 text-og-muted text-sm">{t('friends.noRequests')}</p>
                                ) : requests.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-og-hover transition-colors">
                                        <div className="w-9 h-9 og-avatar-ring text-sm font-bold shrink-0">
                                            {r.from[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-og-body text-sm font-semibold">{r.from}</div>
                                            <div className="text-og-muted text-xs">{t('friends.friendRequestLabel')}</div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button type="button" onClick={() => handleRespond(r.id, true)} className="og-btn-primary px-3 py-1.5 text-xs">{t('friends.accept')}</button>
                                            <button type="button" onClick={() => handleRespond(r.id, false)} className="og-btn-ghost px-3 py-1.5 text-xs">{t('friends.reject')}</button>
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
    const { t } = useTranslation()
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
                <span className={`absolute -bottom-0.5 -start-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--og-surface)] ${
                    friend.online ? 'bg-gn-green' : 'bg-gn-muted'
                }`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-og-body">{friend.username}</div>
                <div className="text-og-muted text-xs">{friend.online ? t('common.online') : t('common.offline')}</div>
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
                {t('friends.remove')}
            </button>
        </div>
    )
}
