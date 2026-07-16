import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
    Globe,
    RefreshCw,
    Power,
    ChevronDown,
    ChevronUp,
    ArrowLeftRight,
    X,
    Check,
    Loader2,
    AlertCircle,
} from 'lucide-react'
import AppShell from '../components/AppShell'
import Icon from '../components/ui/Icon'
import { vpnAPI } from '../api'
import { useNetbirdStore } from '../store/netbirdStore'
import { useNotificationStore } from '../store/notificationStore'

const MOCK_SUBSCRIPTION = {
    plan: 'Premium',
    status: 'active',
    expiresAt: '2026-08-11',
    daysRemaining: 31,
    trafficUsedGb: 12.4,
    trafficLimitGb: 100,
    autoRenew: true,
}

const MOCK_SUPPORTED_SITES = [
    { id: 'steam', name: 'Steam', domain: 'store.steampowered.com' },
    { id: 'epic', name: 'Epic Games', domain: 'epicgames.com' },
    { id: 'battlenet', name: 'Battle.net', domain: 'battle.net' },
    { id: 'riot', name: 'Riot Games', domain: 'riotgames.com' },
    { id: 'ea', name: 'EA', domain: 'ea.com' },
    { id: 'ubisoft', name: 'Ubisoft Connect', domain: 'ubisoft.com' },
    { id: 'discord', name: 'Discord', domain: 'discord.com' },
    { id: 'twitch', name: 'Twitch', domain: 'twitch.tv' },
]

function StatusDot({ active, label }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-og-body">
            <span className={active ? 'status-online' : 'status-offline'} />
            {label}
        </span>
    )
}

function TrafficBar({ used, limit }) {
    const pct = Math.min(100, Math.round((used / limit) * 100))
    return (
        <div className="h-1 rounded-full overflow-hidden bg-white/8">
            <div
                className="h-full rounded-full"
                style={{
                    width: `${pct}%`,
                    background: pct > 85
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : 'var(--og-primary)',
                }}
            />
        </div>
    )
}

function DetailRow({ label, value, mono }) {
    return (
        <div className="flex items-center justify-between gap-6 py-2 border-b border-og last:border-0">
            <span className="text-og-muted text-xs shrink-0">{label}</span>
            <span
                className={`text-og-body text-sm text-end min-w-0 truncate ${mono ? 'font-mono' : ''}`}
                dir={mono ? 'ltr' : undefined}>
                {value}
            </span>
        </div>
    )
}

function SupportedSitesModal({ sites, onClose }) {
    const { t } = useTranslation()

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-drag">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <div
                className="relative w-full max-w-md og-panel p-5 shadow-2xl no-drag"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="og-title text-base text-og-accent">{t('sanctionsRelief.supportedSites.title')}</h3>
                        <p className="text-og-muted text-xs mt-0.5">{t('sanctionsRelief.supportedSites.subtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-og-hover text-og-muted hover:text-og-body transition-colors shrink-0">
                        <Icon icon={X} size="sm" />
                    </button>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-og">
                    {sites.map(site => (
                        <div key={site.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                                <div className="text-og-body text-sm">{site.name}</div>
                                <div className="text-og-muted text-[11px] font-mono ltr truncate">{site.domain}</div>
                            </div>
                            <span className="status-online shrink-0" title={t('sanctionsRelief.supportedSites.supported')} />
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    )
}

function SubscriptionSection({ sub, subActive, subStatusLabel, expiresFormatted }) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)
    const trafficRemaining = Math.max(0, +(sub.trafficLimitGb - sub.trafficUsedGb).toFixed(1))

    return (
        <section className="og-card rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="og-title text-sm text-og-body">{t('sanctionsRelief.subscription.title')}</h2>
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        disabled
                        className="og-btn-primary text-xs px-3 py-1.5 opacity-50 cursor-not-allowed flex items-center gap-1"
                        title={t('sanctionsRelief.comingSoon')}>
                        <Icon icon={RefreshCw} size={12} />
                        {subActive
                            ? t('sanctionsRelief.subscription.renew')
                            : t('sanctionsRelief.subscription.subscribe')}
                    </button>
                    <button
                        type="button"
                        disabled
                        className="text-xs text-og-accent opacity-50 cursor-not-allowed flex items-center gap-1"
                        title={t('sanctionsRelief.comingSoon')}>
                        <Icon icon={ArrowLeftRight} size={12} />
                        {t('sanctionsRelief.subscription.changePlan')}
                    </button>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full text-start group">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="og-title text-og-accent">{sub.plan}</span>
                        <span className="text-og-muted">·</span>
                        <StatusDot active={subActive} label={subStatusLabel} />
                        <span className="text-og-muted">·</span>
                        <span className="text-og-body">
                            {t('sanctionsRelief.subscription.trafficRemaining', { amount: trafficRemaining })}
                        </span>
                    </div>
                    <Icon
                        icon={expanded ? ChevronUp : ChevronDown}
                        size={14}
                        className="text-og-muted group-hover:text-og-body shrink-0"
                    />
                </div>
                <div className="mt-3">
                    <TrafficBar used={sub.trafficUsedGb} limit={sub.trafficLimitGb} />
                </div>
            </button>

            {expanded && (
                <div className="mt-3 pt-3 border-t border-og">
                    <DetailRow label={t('sanctionsRelief.subscription.expiresAt')} value={expiresFormatted} />
                    <DetailRow
                        label={t('sanctionsRelief.subscription.daysRemaining')}
                        value={t('sanctionsRelief.subscription.daysCount', { count: sub.daysRemaining })}
                    />
                    <DetailRow
                        label={t('sanctionsRelief.subscription.autoRenew')}
                        value={sub.autoRenew
                            ? t('sanctionsRelief.subscription.autoRenewOn')
                            : t('sanctionsRelief.subscription.autoRenewOff')}
                    />
                    <DetailRow
                        label={t('sanctionsRelief.subscription.trafficUsed')}
                        value={`${sub.trafficUsedGb} / ${sub.trafficLimitGb} GB`}
                        mono
                    />
                </div>
            )}
        </section>
    )
}

// ─────────────────────────── DNS List tab ──────────────────────────────

// og-success فقط به‌صورت CSS var/کلاس ثابت تعریف شده (نه به‌عنوان رنگ Tailwind)،
// پس برای پس‌زمینه/بردر با شفافیت دلخواه از color-mix با همون CSS var استفاده
// می‌کنیم تا با تم روشن/تاریک هم‌خوان بمونه (به‌جای کلاس‌های نامعتبر مثل bg-og-success/10).
const successTint = (pct) => `color-mix(in srgb, var(--og-success) ${pct}%, transparent)`

function ServerCard({ server, isConnected, isConnecting, disabled, onConnect }) {
    const { t } = useTranslation()

    return (
        <div
            className="relative overflow-hidden og-card rounded-xl p-5 transition-all"
            style={isConnected ? { boxShadow: `0 0 0 1px ${successTint(55)}` } : undefined}>
            <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(ellipse 70% 60% at 15% 15%, rgba(0,218,243,0.16) 0%, transparent 60%)' }}
            />

            <div className="relative flex items-start gap-3 mb-4">
                <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                        isConnected ? '' : 'bg-og-primary-dim border-og-primary'
                    }`}
                    style={isConnected ? { background: successTint(12), borderColor: successTint(35) } : undefined}>
                    <Icon icon={Globe} size="md" className={isConnected ? 'text-og-success' : 'text-og-accent'} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="og-title text-base text-og-body truncate">{server.displayName}</h3>
                    {server.description && (
                        <p className="text-og-muted text-xs mt-0.5 line-clamp-2">{server.description}</p>
                    )}
                </div>
                {isConnected && (
                    <span className="status-online shrink-0 mt-1.5" title={t('sanctionsRelief.dns.connected')} />
                )}
            </div>

            <button
                type="button"
                onClick={onConnect}
                disabled={isConnecting || isConnected || disabled}
                className={`relative w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isConnected ? 'cursor-default' : 'og-btn-primary disabled:opacity-60 disabled:cursor-not-allowed'
                }`}
                style={isConnected
                    ? { background: successTint(15), border: `1px solid ${successTint(40)}`, color: 'var(--og-success)' }
                    : undefined}>
                {isConnecting ? (
                    <>
                        <Icon icon={Loader2} size="sm" className="animate-spin" />
                        {t('sanctionsRelief.dns.connecting')}
                    </>
                ) : isConnected ? (
                    <>
                        <Icon icon={Check} size="sm" />
                        {t('sanctionsRelief.dns.connected')}
                    </>
                ) : (
                    <>
                        <Icon icon={Power} size="sm" />
                        {t('sanctionsRelief.dns.connect')}
                    </>
                )}
            </button>
        </div>
    )
}

function DnsListTab({ servers, loading, error, onRetry, status, connectingId, onConnect }) {
    const { t } = useTranslation()

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin mb-3" />
                <p className="text-og-muted text-xs">{t('common.loading')}</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon icon={AlertCircle} size="lg" className="text-og-danger opacity-70 mb-3" />
                <p className="text-og-body text-sm mb-3">{error}</p>
                <button type="button" onClick={onRetry} className="og-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <Icon icon={RefreshCw} size={12} />
                    {t('sanctionsRelief.dns.retry')}
                </button>
            </div>
        )
    }

    if (servers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon icon={Globe} size="lg" className="text-og-accent opacity-40 mb-3" />
                <p className="text-og-muted text-sm">{t('sanctionsRelief.dns.empty')}</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servers.map(server => {
                const isConnected = status.connected && status.server?.id === server.id
                const isConnecting = connectingId === server.id
                const disabled = connectingId != null && connectingId !== server.id
                return (
                    <ServerCard
                        key={server.id}
                        server={server}
                        isConnected={isConnected}
                        isConnecting={isConnecting}
                        disabled={disabled}
                        onConnect={() => onConnect(server.id, server.displayName)}
                    />
                )
            })}
        </div>
    )
}

// ─────────────────────────── Status tab ────────────────────────────────

function StatusTab({ status, statusLoading, netbirdIp, disconnecting, onDisconnect, onGoToList, onOpenSites }) {
    const { t, i18n } = useTranslation()

    const sub = MOCK_SUBSCRIPTION
    const subActive = sub.status === 'active'
    const subStatusLabel = {
        active: t('sanctionsRelief.subscription.statusActive'),
        expired: t('sanctionsRelief.subscription.statusExpired'),
        pending: t('sanctionsRelief.subscription.statusPending'),
    }[sub.status] ?? sub.status

    const expiresFormatted = new Date(sub.expiresAt).toLocaleDateString(i18n.language, {
        year: 'numeric', month: 'long', day: 'numeric',
    })

    const connected = !!status.connected
    const connectedAtFormatted = status.connectedAt
        ? new Date(status.connectedAt).toLocaleString(i18n.language, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        : null

    return (
        <div className="space-y-4">
            <SubscriptionSection
                sub={sub}
                subActive={subActive}
                subStatusLabel={subStatusLabel}
                expiresFormatted={expiresFormatted}
            />

            <section className="og-card rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="og-title text-sm text-og-body">{t('sanctionsRelief.connection.title')}</h2>
                    <StatusDot
                        active={connected}
                        label={connected
                            ? t('sanctionsRelief.connection.statusConnected')
                            : t('sanctionsRelief.connection.statusDisconnected')}
                    />
                </div>

                {statusLoading ? (
                    <div className="py-6 text-center text-og-muted text-xs">{t('common.loading')}</div>
                ) : connected ? (
                    <div>
                        <DetailRow label={t('sanctionsRelief.connection.server')} value={status.server?.displayName ?? '—'} />
                        <DetailRow label={t('sanctionsRelief.connection.ip')} value={netbirdIp || '—'} mono />
                        {connectedAtFormatted && (
                            <DetailRow label={t('sanctionsRelief.connection.lastConnected')} value={connectedAtFormatted} />
                        )}
                    </div>
                ) : (
                    <p className="text-og-muted text-xs py-2 leading-relaxed">
                        {t('sanctionsRelief.connection.notConnectedHint')}
                    </p>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-og">
                    {connected ? (
                        <button
                            type="button"
                            onClick={onDisconnect}
                            disabled={disconnecting}
                            className="og-btn-danger flex-1 flex items-center justify-center gap-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                            <Icon icon={disconnecting ? Loader2 : Power} size={13} className={disconnecting ? 'animate-spin' : ''} />
                            {disconnecting
                                ? t('sanctionsRelief.connection.disconnecting')
                                : t('sanctionsRelief.connection.disconnect')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onGoToList}
                            className="og-btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm">
                            <Icon icon={Power} size={13} />
                            {t('sanctionsRelief.connection.connect')}
                        </button>
                    )}
                </div>
            </section>

            <button
                type="button"
                onClick={onOpenSites}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-og text-start hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon icon={Globe} size={14} className="text-og-accent shrink-0" />
                    <span className="text-og-body text-sm">{t('sanctionsRelief.supportedSites.viewAll')}</span>
                </div>
                <span className="text-og-muted text-xs shrink-0">
                    {t('sanctionsRelief.supportedSites.count', { count: MOCK_SUPPORTED_SITES.length })}
                </span>
            </button>
        </div>
    )
}

// ─────────────────────────── Page ──────────────────────────────────────

export default function SanctionsReliefPage() {
    const { t } = useTranslation()
    const { toast } = useNotificationStore()
    const netbirdIp = useNetbirdStore(s => s.ip)

    const [tab, setTab] = useState('dnsList')
    const [sitesModalOpen, setSitesModalOpen] = useState(false)

    const [servers, setServers] = useState([])
    const [serversLoading, setServersLoading] = useState(true)
    const [serversError, setServersError] = useState('')

    const [status, setStatus] = useState({ connected: false })
    const [statusLoading, setStatusLoading] = useState(true)

    const [connectingId, setConnectingId] = useState(null)
    const [disconnecting, setDisconnecting] = useState(false)

    const fetchServers = useCallback(async () => {
        setServersLoading(true)
        setServersError('')
        try {
            const res = await vpnAPI.listServers()
            setServers(Array.isArray(res.data) ? res.data : [])
        } catch (e) {
            setServersError(e.response?.data?.message || t('sanctionsRelief.dns.loadError'))
        } finally {
            setServersLoading(false)
        }
    }, [t])

    const fetchStatus = useCallback(async () => {
        try {
            const res = await vpnAPI.status()
            setStatus(res.data || { connected: false })
        } catch {
            setStatus({ connected: false })
        } finally {
            setStatusLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchServers()
        fetchStatus()
    }, [fetchServers, fetchStatus])

    async function handleConnect(serverId, displayName) {
        setConnectingId(serverId)
        try {
            await vpnAPI.connect(serverId)
            await fetchStatus()
            toast(t('sanctionsRelief.dns.connectSuccess', { name: displayName }), 'success')
        } catch (e) {
            toast(e.response?.data?.message || t('sanctionsRelief.dns.connectError'), 'error')
        } finally {
            setConnectingId(null)
        }
    }

    async function handleDisconnect() {
        setDisconnecting(true)
        try {
            await vpnAPI.disconnect()
            await fetchStatus()
            toast(t('sanctionsRelief.connection.disconnectSuccess'), 'success')
        } catch (e) {
            toast(e.response?.data?.message || t('sanctionsRelief.connection.disconnectError'), 'error')
        } finally {
            setDisconnecting(false)
        }
    }

    const TABS = [
        { id: 'dnsList', label: t('sanctionsRelief.tabDnsList') },
        { id: 'status', label: t('sanctionsRelief.tabStatus') },
    ]

    return (
        <AppShell>
            <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
                <div className="flex-shrink-0 px-5 pt-5 max-w-2xl mx-auto w-full">
                    <h1 className="og-title text-lg text-og-accent mb-1">{t('sanctionsRelief.title')}</h1>
                    <p className="text-og-muted text-xs mb-4">{t('sanctionsRelief.subtitle')}</p>

                    <nav className="flex items-stretch h-11 border-b border-og">
                        {TABS.map(item => {
                            const active = tab === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setTab(item.id)}
                                    className={`flex items-center gap-2 px-4 h-full text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                                        active
                                            ? 'text-og-accent border-og-primary opacity-100'
                                            : 'text-og-muted border-transparent opacity-40 hover:opacity-65'
                                    }`}>
                                    <span>{item.label}</span>
                                </button>
                            )
                        })}
                    </nav>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 max-w-2xl mx-auto w-full">
                    {tab === 'dnsList' && (
                        <DnsListTab
                            servers={servers}
                            loading={serversLoading}
                            error={serversError}
                            onRetry={fetchServers}
                            status={status}
                            connectingId={connectingId}
                            onConnect={handleConnect}
                        />
                    )}

                    {tab === 'status' && (
                        <StatusTab
                            status={status}
                            statusLoading={statusLoading}
                            netbirdIp={netbirdIp}
                            disconnecting={disconnecting}
                            onDisconnect={handleDisconnect}
                            onGoToList={() => setTab('dnsList')}
                            onOpenSites={() => setSitesModalOpen(true)}
                        />
                    )}
                </div>
            </div>

            {sitesModalOpen && (
                <SupportedSitesModal
                    sites={MOCK_SUPPORTED_SITES}
                    onClose={() => setSitesModalOpen(false)}
                />
            )}
        </AppShell>
    )
}
