import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../store/themeStore'
import Icon from './ui/Icon'

export default function ThemeToggle() {
    const { t } = useTranslation()
    const { theme, toggleTheme } = useThemeStore()
    const isDark = theme === 'dark'

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? t('theme.light') : t('theme.dark')}
            aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gn-panel text-gn-muted hover:text-gn-text transition-colors">
            <Icon icon={isDark ? Sun : Moon} size={14} />
        </button>
    )
}
