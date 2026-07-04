// گروه‌بندی پیام‌ها بر اساس روز + برچسب تاریخ (بر اساس زبان فعال)
import i18n from '../i18n'

// کلید روز (سال-ماه-روز) برای گروه‌بندی
function dayKey(date, locale) {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date)
}

// برچسب نمایش روز: «امروز» / «دیروز» / تاریخ محلی
export function dayLabel(dateStr) {
    const locale = i18n.language === 'fa' ? 'fa-IR-u-ca-persian' : i18n.language
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (dayKey(d, locale) === dayKey(today, locale)) return i18n.t('common.today')
    if (dayKey(d, locale) === dayKey(yesterday, locale)) return i18n.t('common.yesterday')

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'long', day: 'numeric'
    }).format(d)
}

// آیا بین دو پیام، روز عوض شده؟ (برای نمایش جداکننده)
export function isNewDay(prevMsg, curMsg) {
    if (!prevMsg) return true
    return dayKey(new Date(prevMsg.sentAt)) !== dayKey(new Date(curMsg.sentAt))
}