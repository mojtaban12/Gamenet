import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const EMOJI_CATEGORIES = {
    frequent: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '😅', '😭', '😡', '👍', '👎', '❤️', '🔥', '💯', '🎮', '🎯', '✅', '❌'],
    faces: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫡', '🤭', '🤫', '🫢'],
    gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '💪', '🦾'],
    gaming: ['🎮', '🕹️', '🎯', '🎲', '♟️', '🃏', '🎰', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '👾', '🤖', '💀', '☠️', '⚔️', '🛡️', '🗡️', '🔫', '💣', '🧨', '⚡', '🔥', '💥', '✨', '🎆', '🎇'],
    love: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],
    symbols: ['💯', '✅', '❌', '⭕', '❗', '❓', '💢', '💬', '💭', '🔔', '🔕', '🎵', '🎶', '💤', '💨', '💦', '🌟', '⭐', '🌈', '☀️', '🌙', '⚡'],
}

const CATEGORY_TABS = [
    { id: 'frequent', icon: '⭐' },
    { id: 'faces', icon: '😊' },
    { id: 'gestures', icon: '👍' },
    { id: 'gaming', icon: '🎮' },
    { id: 'love', icon: '❤️' },
    { id: 'symbols', icon: '💯' },
]

export default function EmojiPicker({ onSelect, onClose, className = '' }) {
    const { t } = useTranslation()
    const [category, setCategory] = useState('frequent')
    const ref = useRef(null)

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) onClose()
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    const emojis = EMOJI_CATEGORIES[category] || []

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={t('emoji.pickerLabel')}
            className={`absolute bottom-full mb-2 end-0 z-50 w-[17rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-og overflow-hidden animate-fade-in no-drag ${className}`}
            style={{
                background: 'color-mix(in srgb, var(--og-surface) 92%, transparent)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
            }}>

            <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 border-b border-og/60 overflow-x-auto">
                {CATEGORY_TABS.map(tab => {
                    const active = category === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            aria-label={t(`emoji.${tab.id}`)}
                            aria-pressed={active}
                            onClick={() => setCategory(tab.id)}
                            className={`flex-shrink-0 w-7 h-7 rounded-full text-[15px] leading-none transition-all ${
                                active
                                    ? 'bg-og-primary-dim opacity-100'
                                    : 'opacity-45 hover:opacity-90 hover:bg-og-hover'
                            }`}>
                            {tab.icon}
                        </button>
                    )
                })}
            </div>

            <div className="p-1.5 max-h-40 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-8">
                    {emojis.map((emoji, i) => (
                        <button
                            key={`${category}-${emoji}-${i}`}
                            type="button"
                            onClick={() => onSelect(emoji)}
                            className="w-8 h-8 flex items-center justify-center text-[17px] rounded-md transition-colors hover:bg-og-hover active:bg-og-primary-dim">
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
