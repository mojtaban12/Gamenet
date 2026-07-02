import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Swords, Users, History, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { useUiStore } from '../store/uiStore'
import { useLobbyStore } from '../store/lobbyStore'
import NetworkStatus from './NetworkStatus'
import UpdateBar from './UpdateBar'
import Icon from './ui/Icon'

const NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'خانه', path: '/home' },
    { id: 'rooms', icon: Swords, label: 'لابی‌ها', path: '/rooms' },
    { id: 'friends', icon: Users, label: 'دوستان', path: '/friends' },
    { id: 'history', icon: History, label: 'تاریخچه', path: null },
]

function getActiveNavId(pathname) {
    if (pathname === '/home') return 'home'
    if (pathname.startsWith('/rooms') || pathname.startsWith('/lobby')) return 'rooms'
    if (pathname.startsWith('/friends')) return 'friends'
    if (pathname.startsWith('/profile')) return 'profile'
    if (pathname.startsWith('/admin')) return 'admin'
    return null
}

function NavItem({ icon, label, active, onClick, disabled, className = '' }) {
    return (
        <button
            type="button"
            onClick={e => {
                e.stopPropagation()
                onClick?.(e)
            }}
            disabled={disabled}
            className={`relative z-10 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'og-nav-item-active border' : 'og-nav-item border border-transparent'
            } ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-og-muted' : ''} ${className}`}>
            <Icon
                icon={icon}
                size="md"
                className={active ? 'text-og-accent drop-shadow-[0_0_6px_rgba(0,229,255,0.45)]' : ''}
            />
            <span className="og-title text-sm font-medium">{label}</span>
        </button>
    )
}

function NavSubItem({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={e => {
                e.stopPropagation()
                onClick?.(e)
            }}
            className={`relative z-10 w-full flex items-center gap-2 pr-9 pl-3 py-2 rounded-lg text-xs transition-colors truncate ${
                active ? 'og-nav-item-active border' : 'og-nav-item border border-transparent'
            }`}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-og-accent opacity-70" />
            <span className="og-title font-medium truncate">{label}</span>
        </button>
    )
}

export default function AppSidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useAuthStore()
    const { connected, reconnecting } = useNetbirdStore()
    const isAdmin = user?.role === 'Admin'
    const openLogoutModal = useUiStore(s => s.openLogoutModal)
    const activeLobby = useLobbyStore(s => s.activeLobby)
    const activeId = getActiveNavId(location.pathname)
    const isOnLobbyPage = location.pathname.startsWith('/lobby/')
    const lobbyLabel = activeLobby?.groupName || activeLobby?.groupId

    return (
        <div className="w-64 shrink-0 min-h-0 flex flex-col overflow-hidden p-4">
            <div className="og-panel flex-1 min-h-0 flex flex-col overflow-hidden p-4">
                <div className="pb-4 mb-1 border-b border-og">
                    <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className={`relative z-10 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-right ${
                            activeId === 'profile'
                                ? 'og-nav-item-active border'
                                : 'og-nav-item border border-transparent'
                        }`}>
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 og-avatar-ring overflow-hidden">
                                {user?.avatarUrl
                                    ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" />
                                    : <span className="og-title font-bold text-og-accent text-sm">
                                        {user?.username?.[0]?.toUpperCase()}
                                      </span>
                                }
                            </div>
                            <span
                                className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-gn-bg ${
                                    connected
                                        ? 'bg-gn-green shadow-[0_0_6px_var(--og-success-glow)]'
                                        : reconnecting
                                            ? 'bg-amber-400 animate-pulse'
                                            : 'bg-gn-muted'
                                }`}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="og-title text-sm font-medium truncate">
                                {user?.username}
                            </div>
                            <div className="text-[11px] mt-0.5 opacity-60">
                                {connected ? 'آنلاین' : reconnecting ? 'در حال اتصال مجدد...' : 'آفلاین'}
                            </div>
                        </div>
                    </button>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-2">
                    {NAV_ITEMS.map(item => (
                        <div key={item.id}>
                            <NavItem
                                icon={item.icon}
                                label={item.label}
                                active={activeId === item.id && !(item.id === 'rooms' && isOnLobbyPage)}
                                disabled={!item.path}
                                onClick={item.path ? () => navigate(item.path) : undefined}
                            />
                            {item.id === 'rooms' && activeLobby && (
                                <div className="mt-1">
                                    <NavSubItem
                                        label={lobbyLabel}
                                        active={isOnLobbyPage}
                                        onClick={() => navigate(`/lobby/${activeLobby.groupId}`)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                <div className="flex-shrink-0 mt-4">
                    {isAdmin && (
                        <div className="mb-2">
                            <NavItem
                                icon={ShieldCheck}
                                label="مدیریت"
                                active={activeId === 'admin'}
                                onClick={() => navigate('/admin')}
                            />
                        </div>
                    )}
                    <UpdateBar />
                    <NetworkStatus />
                    <button
                        type="button"
                        onClick={openLogoutModal}
                        className="og-btn-danger w-full relative z-10">
                        خروج
                    </button>
                </div>
            </div>
        </div>
    )
}
