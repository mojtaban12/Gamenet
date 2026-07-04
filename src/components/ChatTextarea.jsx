import { useRef, useLayoutEffect, useState } from 'react'

/**
 * اینپوتِ چندخطیِ چت.
 *   - Enter        → ارسال پیام
 *   - Ctrl+Enter   → خط جدید
 *   - Shift+Enter  → خط جدید
 * ارتفاع خودکار با محتوا رشد می‌کنه (تا maxHeight) و بعد از پاک‌شدنِ متن ریست می‌شه.
 *
 * props:
 *   value     مقدار کنترل‌شده (string)
 *   onChange  (nextString) => void   ← رشته‌ی جدید رو می‌گیره، نه event
 *   onSend    () => void
 *   بقیه‌ی propها (placeholder, disabled, maxLength, className, style, autoFocus, onFocus, onBlur) pass-through
 */
export default function ChatTextarea({
    value,
    onChange,
    onSend,
    maxHeight = 110,
    className = '',
    ...rest
}) {
    const ref = useRef(null)
    const singleLineHeightRef = useRef(null)
    const [scrollable, setScrollable] = useState(false)

    // auto-grow: ارتفاع رو با محتوا تنظیم کن؛ اسکرول فقط وقتی چندخطی شد
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        el.style.height = 'auto'
        const sh = el.scrollHeight
        if (!value || singleLineHeightRef.current === null) {
            singleLineHeightRef.current = sh
        }
        el.style.height = Math.min(sh, maxHeight) + 'px'
        setScrollable(sh > singleLineHeightRef.current)
    }, [value, maxHeight])

    function onKeyDown(e) {
        // وسطِ ترکیبِ IME (تایپ چندمرحله‌ای) Enter رو نادیده بگیر تا زودتر نفرسته
        if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return

        if (e.ctrlKey || e.shiftKey) {
            // خط جدید — Ctrl+Enter به‌صورت پیش‌فرض \n اضافه نمی‌کنه، پس دستی اضافه می‌کنیم
            e.preventDefault()
            const el = e.target
            const s  = el.selectionStart ?? value.length
            const en = el.selectionEnd   ?? value.length
            onChange(value.slice(0, s) + '\n' + value.slice(en))
            // مکان‌نما رو بعد از \n نگه دار
            requestAnimationFrame(() => {
                try { el.selectionStart = el.selectionEnd = s + 1 } catch {}
            })
        } else {
            // Enterِ تنها → ارسال (جلوی خط جدیدِ پیش‌فرضِ textarea رو بگیر)
            e.preventDefault()
            onSend()
        }
    }

    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={`resize-none ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'} ${className}`}
            {...rest}
        />
    )
}
