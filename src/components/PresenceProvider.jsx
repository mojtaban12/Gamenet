import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'
import { usePresenceStore } from '../store/presenceStore'
import { useNotificationStore } from '../store/notificationStore'
import { useMessageStore } from '../store/messageStore'
import { useUpdateStore } from '../store/updateStore'
import { useLobbyStore } from '../store/lobbyStore'
import { friendAPI, messageAPI } from '../api'
import { notify } from '../utils/notify'
import { isOlderVersion } from '../utils/version'
import i18n from '../i18n'

const getApiUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:5224'

export default function PresenceProvider({ children }) {
    const { token }                        = useAuthStore()
    const { setHub, setFriends, updateFriend, updateFriendAvatar } = usePresenceStore()
    const { invite, friendRequest }        = useNotificationStore()
    const { addMessage, incrementUnread, setUnreadCounts, bumpMsgNotif, setDmTyping, clearDmTyping } = useMessageStore()
    const navigate                         = useNavigate()

    // debounce timers برای جمع‌بندی نوتیف پیام per friend
    const msgTimers    = useRef({})
    // timers برای expire کردن "در حال نوشتن" per friend
    const typingTimers = useRef({})

    useEffect(() => {
        if (!token) return
        let hub = null
        let reconnecting = false
        let heartbeatTimer = null
        // Set by the effect cleanup. connect() is async and builds the hub only
        // after awaiting loadFriends()/loadUnreadCounts(); if the token clears
        // (logout) during those awaits, cleanup runs while `hub` is still null and
        // hub.stop() is a no-op — the hub created afterwards becomes an orphan that
        // auto-reconnects forever on the login page. We check this flag before and
        // after building the hub to tear such an orphan down immediately.
        let cancelled = false

        // Guard against concurrent loadFriends calls; buffer online/offline events during a load
        let loadingFriends = false
        let pendingLoad = false
        const pendingUpdates = new Map() // userId.lower -> online boolean

        async function loadFriends() {
            if (loadingFriends) { pendingLoad = true; return }
            loadingFriends = true
            try {
                const data = (await friendAPI.getAll()).data
                setFriends(data)
                for (const [uid, online] of pendingUpdates) updateFriend(uid, online)
                pendingUpdates.clear()
            } catch {}
            finally {
                loadingFriends = false
                if (pendingLoad) { pendingLoad = false; await loadFriends() }
            }
        }
        async function loadUnreadCounts() {
            try { setUnreadCounts((await messageAPI.getUnreadCounts()).data) } catch {}
        }

        async function connect() {
            await loadFriends()
            await loadUnreadCounts()
            if (cancelled) return

            hub = new signalR.HubConnectionBuilder()
                .withUrl(`${getApiUrl()}/hubs/presence?access_token=${token}`, {
                    skipNegotiation: false,
                    transport: signalR.HttpTransportType.WebSockets
                })
                .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
                .build()

            // ── فرند آنلاین ─────────────────────────────────────────
            hub.on('FriendOnline', (data) => {
                const target = String(data.userId)
                if (loadingFriends) {
                    pendingUpdates.set(target.toLowerCase(), true)
                } else {
                    const inList = usePresenceStore.getState().friends
                        .some(f => String(f.friendId).toLowerCase() === target.toLowerCase())
                    if (inList) updateFriend(data.userId, true)
                    else { pendingUpdates.set(target.toLowerCase(), true); loadFriends() }
                }
                notify({
                    title: 'TarGame',
                    body:  i18n.t('presence.friendOnline', { username: data.username }),
                    type:  'success',
                    sound: 'friendOnline',
                    toastDuration: 5000
                })
            })

            // ── فرند آفلاین ─────────────────────────────────────────
            hub.on('FriendOffline', (data) => {
                if (loadingFriends) {
                    pendingUpdates.set(String(data.userId).toLowerCase(), false)
                } else {
                    updateFriend(data.userId, false)
                }
                notify({
                    title: 'TarGame',
                    body:  i18n.t('presence.friendOffline', { username: data.username }),
                    type:  'info',
                    sound: 'friendOffline',
                    toastDuration: 4000
                })
            })

            // ── آپدیت آواتار فرند ───────────────────────────────────
            hub.on('FriendAvatarUpdated', (data) => {
                updateFriendAvatar(data.userId, data.avatarUrl)
            })

            // ── درخواست دوستی ───────────────────────────────────────
            hub.on('FriendRequest', (data) => {
                friendRequest({ requestId: data.requestId, fromId: data.fromId, username: data.username })
                window.dispatchEvent(new CustomEvent('notif:new'))
                notify({
                    title: i18n.t('presence.friendRequestTitle'),
                    body:  i18n.t('presence.friendRequestBody', { username: data.username }),
                    type:  'info',
                    sound: 'friendRequest'
                })
            })

            // ── قبول درخواست ────────────────────────────────────────
            hub.on('FriendRequestAccepted', (data) => {
                window.dispatchEvent(new CustomEvent('notif:new'))
                loadFriends()
                notify({
                    title: 'TarGame',
                    body:  i18n.t('presence.friendRequestAcceptedBody', { username: data.username }),
                    type:  'success',
                    sound: 'notify',
                    toastDuration: 5000
                })
            })

            // ── در حال نوشتن DM ─────────────────────────────────────
            hub.on('Typing', ({ fromId, username }) => {
                setDmTyping(fromId, username)
                clearTimeout(typingTimers.current[fromId])
                typingTimers.current[fromId] = setTimeout(() => clearDmTyping(fromId), 3000)
            })

            // ── پیام مستقیم ─────────────────────────────────────────
            hub.on('DirectMessage', (msg) => {
                const myId = useAuthStore.getState().user?.id?.toString()
                const friendId = msg.senderId === myId ? msg.receiverId : msg.senderId

                addMessage(friendId, msg)
                if (msg.senderId === myId) return // echo خودم

                const activeChat = window.__activeChatFriendId
                if (activeChat === friendId) {
                    sounds_message()
                    return // چت بازه، نیاز به نوتیف نیست
                }

                incrementUnread(friendId)

                // اگه کاربر توی لابیه → فلوت چت رو مدیریت کن (باز خودکار یا toast سوییچ)
                if (window.location.hash.includes('/lobby/')) {
                    sounds_message()
                    window.dispatchEvent(new CustomEvent('dm:incoming', {
                        detail: { friendId: friendId?.toString(), senderName: msg.senderName }
                    }))
                    return
                }

                // جمع‌بندی نوتیف با debounce
                const count = bumpMsgNotif(friendId, msg.senderName)
                clearTimeout(msgTimers.current[friendId])
                msgTimers.current[friendId] = setTimeout(() => {
                    const finalCount = useMessageStore.getState().msgNotifs[friendId]?.count || count
                    const body = finalCount === 1
                        ? i18n.t('presence.newMessageOne', { username: msg.senderName })
                        : i18n.t('presence.newMessageMany', { count: finalCount, username: msg.senderName })

                    notify({
                        title: i18n.t('presence.newMessageTitle'),
                        body,
                        type:  'info',
                        sound: 'message',
                        toastDuration: 5000
                    })
                    useMessageStore.getState().clearMsgNotif(friendId)
                }, 800) // 800ms صبر برای جمع کردن پیام‌های پشت سر هم
            })

            // ── آپدیت اجباری از سرور ────────────────────────────────────
            hub.on('AppUpdate', (data) => {
                if (!window.electron?.update) return
                const latestVersion = String(data.version ?? data.updates?.[0]?.version ?? '')
                const currentVersion = window.electron?.appVersion || (typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '0.0.0')
                if (!latestVersion || !isOlderVersion(currentVersion, latestVersion)) return
                const updates = [{ component: 'app', version: latestVersion }]
                useUpdateStore.getState().setForcePrompt(updates)
                useNotificationStore.getState().forceUpdate({ updates, latestVersion })
            })

            // ── خروج اجباری (لاگین روی سیستم دیگه) ──────────────────
            hub.on('ForceLogout', (data) => {
                // آیا توکنِ فعلیِ این سیستم همون سشنِ جدیده؟ یعنی این ForceLogout
                // در واقع مالِ خودِ همین سیستمه و نباید لاگ‌اوت شیم.
                const isOwnNewSession = () => {
                    try {
                        const myToken = useAuthStore.getState().token
                        if (myToken && data?.newSessionId) {
                            const payload = JSON.parse(atob(myToken.split('.')[1]))
                            return payload.sid === data.newSessionId
                        }
                    } catch {}
                    return false
                }

                // اگه همین الان معلومه خودمونیم، اصلاً کاری نکن.
                if (isOwnNewSession()) return

                // دوباره لحظه‌ی خروج چک کن (نه فقط موقع دریافت): وقتی کاربر برمی‌گرده
                // و لاگین می‌کنه ولی یک سشنِ ghost قدیمی هنوز پاک نشده، پاسخِ لاگین
                // (توکنِ سشن جدید) ممکنه با کمی تأخیر بعد از این پیام برسه. با چکِ
                // مجدد در این لحظه، اگه توکن به سشن جدید آپدیت شده باشه خودمون رو
                // بیرون نمی‌ندازیم — رفعِ باگِ «کاربر دیگه‌ای آنلاین شد» موقع برگشت.
                setTimeout(() => {
                    if (isOwnNewSession()) return
                    notify({
                        title: i18n.t('presence.logoutTitle'),
                        body: data?.reason || i18n.t('presence.logoutBody'),
                        type: 'info',
                        sound: 'notify'
                    })
                    useAuthStore.getState().logout()
                }, 1500)
            })

            // ── دعوت لابی ───────────────────────────────────────────
            hub.on('LobbyInvite', (data) => {
                invite({ fromId: data.fromId, username: data.username, groupId: data.groupId, groupName: data.groupName })
                notify({
                    title: i18n.t('presence.lobbyInviteTitle'),
                    body:  i18n.t('presence.lobbyInviteBody', { username: data.username, groupName: data.groupName }),
                    type:  'info',
                    sound: 'invite'
                })
            })

            hub.onreconnecting(() => { reconnecting = true })
            hub.onreconnected(async () => { reconnecting = false; await loadFriends() })
            hub.onclose(() => {
                if (!reconnecting) {
                    setFriends(usePresenceStore.getState().friends.map(f => ({ ...f, online: false })))
                }
            })

            try {
                await hub.start()
                if (cancelled) { hub.stop(); return }
                setHub(hub)
                // heartbeat دوره‌ای تا سرور این connection رو زنده بدونه؛ بدون این،
                // اگه قطعِ کثیف رخ بده، entryِ Redis تا prune شدن (~۴۵ث) می‌مونه.
                heartbeatTimer = setInterval(() => {
                    hub.invoke('Heartbeat').catch(() => {})
                }, 15000)
            } catch (err) {
                console.error('Presence hub error:', err)
            }
        }

        connect()
        return () => {
            cancelled = true
            if (heartbeatTimer) clearInterval(heartbeatTimer)
            hub?.stop()
            setHub(null)
        }
    }, [token])

    // کلیک روی نوتیف native → برو به صفحه دوستان
    useEffect(() => {
        window.electron?.notify.onClicked(() => {
            navigate('/friends')
        })
    }, [])

    return children
}

// import محلی برای صدا (جلوگیری از circular)
function sounds_message() {
    import('../utils/sound').then(m => m.sounds.message())
}