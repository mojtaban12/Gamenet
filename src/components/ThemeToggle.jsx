import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import Icon from './ui/Icon'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useThemeStore()
    const isDark = theme === 'dark'

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'تم روشن' : 'تم تیره'}
            aria-label={isDark ? 'تغییر به تم روشن' : 'تغییر به تم تیره'}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors">
            <Icon icon={isDark ? Sun : Moon} size={14} />
        </button>
    )
}
