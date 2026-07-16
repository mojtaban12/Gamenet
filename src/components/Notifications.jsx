import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpCircle, CheckCircle2, Info, Swords, X, XCircle } from 'lucide-react'
import { useNotificationStore } from '../store/notificationStore'
import { useUpdateStore } from '../store/updateStore'
import { useSetupStore, PHASE } from '../store/setupStore'
import { friendAPI } from '../api'
import { netbirdAPI } from '../api'
import { withPeerRecovery } from '../utils/peerRecovery'
import { usePresenceStore } from '../store/presenceStore'
import Icon from './ui/Icon'

export default function Notifications() {
    const { notifications, remove } = useNotificationStore()

    return (
        <div className="fixed top-12 start-4 z-50 flex flex-col gap-2 w-80">
            {notifications.map(n => (
                <NotificationItem key={n.id} notif={n} onRemove={() => remove(n.id)} />
            ))}
        </div>
    )
}

function NotificationItem({ notif, onRemove }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const networkReady = useSetupStore(s => s.phase === PHASE.DONE)

    if (notif.kind === 'toast') {
        return (
            <div
                onClick={notif.onClick ? () => { notif.onClick(); onRemove() } : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border animate-slide-up shadow-lg ${notif.onClick ? 'cursor-pointer hover:border-gn-accent/50' : ''}
        ${notif.type === 'success' ? 'bg-gn-surface border-gn-green/30' :
                    notif.type === 'error'   ? 'bg-gn-surface border-gn-red/30' :
                        'bg-gn-surface border-gn-border'}`}>
        <span className={`text-sm flex-shrink-0
          ${notif.type === 'success' ? 'text-gn-green' :
            notif.type === 'error'   ? 'text-gn-red' : 'text-gn-accent'}`}>
          <Icon
              icon={notif.type === 'success' ? CheckCircle2 : notif.type === 'error' ? XCircle : Info}
              size="sm"
          />
        </span>
                <span className="text-gn-text text-xs flex-1">{notif.message}</span>
                <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="text-gn-muted hover:text-gn-text flex items-center justify-center w-5 h-5">
                    <Icon icon={X} size="xs" />
                </button>
            </div>
        )
    }

    if (notif.kind === 'invite') {
        return (
            <div className="bg-gn-surface border border-gn-accent/30 rounded-lg p-4 animate-slide-up shadow-lg"
                 style={{ boxShadow: '0 0 20px rgba(0,212,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded bg-gn-accent/20 border border-gn-accent/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-gn-accent text-xs font-bold">{notif.username?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-gn-text text-xs font-semibold">{notif.username}</div>
                        <div className="text-gn-muted text-xs">{t('notifications.inviteToLobby')}</div>
                    </div>
                    <button onClick={onRemove} className="text-gn-muted hover:text-gn-text flex items-center justify-center w-5 h-5 flex-shrink-0">
                        <Icon icon={X} size="xs" />
                    </button>
                </div>
                <div className="text-gn-accent text-xs mb-3 truncate flex items-center gap-1.5">
                    <Icon icon={Swords} size="xs" className="shrink-0" />
                    {notif.groupName}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            if (!networkReady) return
                            try {
                                await withPeerRecovery(() => netbirdAPI.joinGroup(notif.groupId))
                                navigate(`/lobby/${notif.groupId}`)
                            } catch {}
                            onRemove()
                        }}
                        disabled={!networkReady}
                        title={!networkReady ? t('notifications.connectingToNetwork') : ''}
                        className="flex-1 py-1.5 text-xs bg-gn-accent text-gn-bg rounded transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                        {networkReady ? t('notifications.join') : t('common.connecting')}
                    </button>
                    <button
                        onClick={onRemove}
                        className="flex-1 py-1.5 text-xs border border-gn-border text-gn-muted hover:text-gn-text rounded transition-colors">
                        {t('notifications.dismiss')}
                    </button>
                </div>
            </div>
        )
    }

    if (notif.kind === 'forceUpdate') {
        return (
            <div className="bg-gn-surface border border-gn-accent/40 rounded-lg p-4 animate-slide-up shadow-lg"
                 style={{ boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded bg-gn-accent/20 border border-gn-accent/30 flex items-center justify-center flex-shrink-0">
                        <Icon icon={ArrowUpCircle} size="sm" className="text-gn-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-gn-text text-xs font-semibold">{t('notifications.newUpdateAvailable')}</div>
                        <div className="text-gn-muted text-xs">{t('notifications.versionLabel', { version: notif.latestVersion })}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            useUpdateStore.getState().setForce(notif.updates)
                            window.electron?.update?.download()
                            onRemove()
                        }}
                        className="flex-1 py-1.5 text-xs bg-gn-accent text-gn-bg rounded hover:opacity-90 transition-opacity font-medium">
                        {t('notifications.updateNow')}
                    </button>
                    <button
                        onClick={() => {
                            useUpdateStore.getState().reset()
                            onRemove()
                        }}
                        className="flex-1 py-1.5 text-xs border border-gn-border text-gn-muted hover:text-gn-text rounded transition-colors">
                        {t('notifications.updateLater')}
                    </button>
                </div>
            </div>
        )
    }

    if (notif.kind === 'friendRequest') {
        return (
            <div className="bg-gn-surface border border-gn-border rounded-lg p-4 animate-slide-up shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded bg-gn-accent2/20 border border-gn-accent2/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-gn-accent2 text-xs font-bold">{notif.username?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-gn-text text-xs font-semibold">{notif.username}</div>
                        <div className="text-gn-muted text-xs">{t('notifications.friendRequestLabel')}</div>
                    </div>
                    <button onClick={onRemove} className="text-gn-muted hover:text-gn-text flex items-center justify-center w-5 h-5 flex-shrink-0">
                        <Icon icon={X} size="xs" />
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            try {
                                await friendAPI.respond(notif.requestId, true)
                                // accepter رویداد realtime نمی‌گیره (سرور فقط به
                                // requester خبر می‌ده)، پس خودمون لیست رو رفرش می‌کنیم.
                                const data = (await friendAPI.getAll()).data
                                usePresenceStore.getState().setFriends(data)
                            } catch {}
                            onRemove()
                        }}
                        className="flex-1 py-1.5 text-xs bg-gn-accent2/80 text-white rounded hover:opacity-90 transition-opacity">
                        {t('notifications.accept')}
                    </button>
                    <button
                        onClick={async () => {
                            try { await friendAPI.respond(notif.requestId, false) } catch {}
                            onRemove()
                        }}
                        className="flex-1 py-1.5 text-xs border border-gn-border text-gn-muted hover:text-gn-text rounded transition-colors">
                        {t('notifications.reject')}
                    </button>
                </div>
            </div>
        )
    }

    return null
}