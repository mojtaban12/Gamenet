import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fa from '../locales/fa.json'
import en from '../locales/en.json'

export const LOCALES = {
    fa: { label: 'فارسی', dir: 'rtl', flag: 'FA' },
    en: { label: 'English', dir: 'ltr', flag: 'EN' },
}

export const DEFAULT_LOCALE = 'fa'

i18n
    .use(initReactI18next)
    .init({
        resources: {
            fa: { translation: fa },
            en: { translation: en },
        },
        lng: DEFAULT_LOCALE,
        fallbackLng: 'fa',
        interpolation: { escapeValue: false },
        returnEmptyString: false,
    })

export default i18n
