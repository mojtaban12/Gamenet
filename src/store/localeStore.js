import { create } from 'zustand'
import i18n, { LOCALES, DEFAULT_LOCALE } from '../i18n'

const STORAGE_KEY = 'targame-locale'

export function applyLocale(locale) {
    const meta = LOCALES[locale] || LOCALES[DEFAULT_LOCALE]
    document.documentElement.setAttribute('lang', locale)
    document.documentElement.setAttribute('dir', meta.dir)
    if (i18n.language !== locale) i18n.changeLanguage(locale)
}

export const useLocaleStore = create((set, get) => ({
    locale: DEFAULT_LOCALE,

    hydrate: () => {
        const saved = localStorage.getItem(STORAGE_KEY)
        const locale = LOCALES[saved] ? saved : DEFAULT_LOCALE
        applyLocale(locale)
        set({ locale })
    },

    setLocale: (locale) => {
        if (!LOCALES[locale]) return
        localStorage.setItem(STORAGE_KEY, locale)
        applyLocale(locale)
        set({ locale })
    },
}))

export function getDir(locale) {
    return (LOCALES[locale] || LOCALES[DEFAULT_LOCALE]).dir
}
