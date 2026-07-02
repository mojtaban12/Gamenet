import { useState, useEffect, useCallback } from 'react'
import { Crown, Gamepad2, RefreshCw, Users, Mic } from 'lucide-react'
import { adminAPI } from '../api'
import AppShell from '../components/AppShell'
import Icon from '../components/ui/Icon'

const REFRESH_INTERVAL = 10_000

export default function AdminPage() {
    const [lobbies,   setLobbies]   = useState([])
    const [loading,   setLoading]   = useState(true)
    const [error,     setError]     = useState('')
    const [lastAt,    setLastAt]    = useState(null)
    const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)

    const fetch = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await adminAPI.getLobbies()
            setLobbies(Array.isArray(res.data) ? res.data : [])
            setLastAt(new Date())
            setCountdown(REFRESH_INTERVAL / 1000)
        } catch (e) {
            setError(e.response?.data?.message || 'خطا در بارگذاری')
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load
    useEffect(() => { fetch() }, [fetch])

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(fetch, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [fetch])

    // Countdown ticker
    useEffect(() => {
        const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
        return () => clearInterval(tick)
    }, [lastAt])

    return (
        <AppShell>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="og-title text-lg text-og-accent">مدیریت لابی‌ها</h1>
                        <p className="text-og-muted text-xs mt-0.5">
                            {lastAt
                                ? `آخرین بروزرسانی: ${lastAt.toLocaleTimeString('fa')} · بروزرسانی بعدی در ${countdown}s`
                                : 'در حال بارگذاری...'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetch}
                        disabled={loading}
                        title="بروزرسانی"
                        className="flex items-center gap-1.5 px-3 py-2 og-btn-ghost text-xs disabled:opacity-50 no-drag">
                        <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
                        <span>بروزرسانی</span>
                    </button>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* ── Empty ── */}
                {!loading && !error && lobbies.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-og-muted">
                        <Icon icon={Users} size={32} className="mb-3 opacity-30" />
                        <p className="text-sm">هیچ لابی فعالی وجود ندارد</p>
                    </div>
                )}

                {/* ── Lobby cards ── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {lobbies.map(lobby => (
                        <LobbyCard key={lobby.groupId} lobby={lobby} />
                    ))}
                </div>
            </div>
        </AppShell>
    )
}

function LobbyCard({ lobby }) {
    const {
        groupId, groupName, memberCount,
        members = [], gameName, isPlaying,
        channels = [],
    } = lobby

    return (
        <div className="og-panel p-4 flex flex-col gap-3">
            {/* ── Card header ── */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h2 className="og-title text-sm text-og-accent truncate">{groupName}</h2>
                    <p className="text-og-muted text-[10px] font-mono mt-0.5 truncate opacity-60">{groupId}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {isPlaying && (
                        <span className="flex items-center gap-1 text-gn-green text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-gn-green animate-pulse" />
                            در حال بازی
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-og-muted text-[11px]">
                        <Icon icon={Users} size={11} />
                        {memberCount}
                    </span>
                </div>
            </div>

            {/* ── Game row ── */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-og-subtle">
                <Icon icon={Gamepad2} size={14} className="text-og-muted shrink-0" />
                <span className="text-xs text-og-body flex-1 min-w-0 truncate">
                    {gameName || 'هیچ بازی‌ای انتخاب نشده'}
                </span>
                {isPlaying && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gn-green/15 text-gn-green shrink-0">
                        فعال
                    </span>
                )}
            </div>

            {/* ── Members ── */}
            <div>
                <p className="og-label text-og-muted text-[11px] mb-1.5">اعضا</p>
                <div className="space-y-1">
                    {members.map(m => (
                        <MemberRow key={m.userId} member={m} />
                    ))}
                </div>
            </div>

            {/* ── Voice channels (only when custom teams exist) ── */}
            {channels.some(c => c.id !== 'lobby') && (
                <div>
                    <p className="og-label text-og-muted text-[11px] mb-1.5 flex items-center gap-1">
                        <Icon icon={Mic} size={10} />
                        کانال‌های صوتی
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {channels.map(ch => (
                            <span
                                key={ch.id}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                                    ch.id === 'lobby'
                                        ? 'bg-og-subtle text-og-muted'
                                        : 'bg-og-primary-dim text-og-accent border border-og-primary/20'
                                }`}>
                                {ch.name}
                                {ch.memberCount > 0 && (
                                    <span className="opacity-70">· {ch.memberCount}</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function MemberRow({ member }) {
    const { username, isHost, channelId, channelName } = member
    const inCustomChannel = channelId && channelId !== 'lobby'

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-og-subtle/50 hover:bg-og-subtle transition-colors">
            {/* avatar */}
            <div className="w-6 h-6 og-avatar-ring text-[10px] font-bold shrink-0 flex-none">
                {(username || '?')[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-og-body font-medium truncate">{username}</span>
                {isHost && (
                    <span className="flex items-center gap-0.5 text-[9px] text-yellow-400 shrink-0">
                        <Icon icon={Crown} size={9} />
                        میزبان
                    </span>
                )}
                {inCustomChannel && (
                    <span className="text-[9px] text-og-accent shrink-0 px-1.5 py-px rounded-full bg-og-primary-dim border border-og-primary/20">
                        {channelName}
                    </span>
                )}
            </div>
        </div>
    )
}
