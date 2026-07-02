import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Icon from './ui/Icon'
import appIcon from '../../assets/icon-32.png'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

export default function TitleBar({ title = 'TARGAME' }) {
    const { token } = useAuthStore()

    return (
        <div
            dir="ltr"
            className="drag-region relative z-50 h-10 bg-gn-surface border-b border-gn-border flex items-center justify-between px-4 select-none flex-shrink-0 overflow-visible">
            <div className="flex items-center gap-3">
                <img
                    src={appIcon}
                    alt=""
                    className="w-5 h-5 object-contain shrink-0"
                    draggable={false}
                />
                <span className="font-display font-bold text-sm tracking-[0.2em] text-gn-accent uppercase">
                    {title}
                </span>
                {APP_VERSION && (
                    <span className="text-gn-muted text-[10px] font-mono opacity-50">v{APP_VERSION}</span>
                )}
            </div>

            <div className="no-drag relative z-50 flex items-center gap-1 overflow-visible">
                {token && <NotificationBell />}

                <ThemeToggle />

                <button
                    onClick={() => window.electron?.window.minimize()}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors">
                    <Icon icon={Minus} size={14} />
                </button>
                <button
                    onClick={() => window.electron?.window.maximize()}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors">
                    <Icon icon={Square} size={12} />
                </button>
                <button
                    onClick={() => window.electron?.window.close()}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/20 text-gn-muted hover:text-gn-red transition-colors">
                    <Icon icon={X} size={14} />
                </button>
            </div>
        </div>
    )
}
