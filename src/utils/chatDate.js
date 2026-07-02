// گروه‌بندی پیام‌ها بر اساس روز + برچسب شمسی

// کلید روز (سال-ماه-روز شمسی) برای گروه‌بندی
function dayKey(date) {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date)
}

// برچسب نمایش روز: «امروز» / «دیروز» / تاریخ شمسی
export function dayLabel(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (dayKey(d) === dayKey(today)) return 'امروز'
    if (dayKey(d) === dayKey(yesterday)) return 'دیروز'

    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric', month: 'long', day: 'numeric'
    }).format(d)
}

// آیا بین دو پیام، روز عوض شده؟ (برای نمایش جداکننده)
export function isNewDay(prevMsg, curMsg) {
    if (!prevMsg) return true
    return dayKey(new Date(prevMsg.sentAt)) !== dayKey(new Date(curMsg.sentAt))
}