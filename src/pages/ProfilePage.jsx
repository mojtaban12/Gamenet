import { useState, useRef, useEffect, useCallback } from 'react'
import {
    User,
    Lock,
    Wallet,
    Package,
    Trophy,
    Camera,
    Settings,
    Keyboard,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNetbirdStore } from '../store/netbirdStore'
import { useNotificationStore } from '../store/notificationStore'
import { authAPI, uploadAPI } from '../api'
import { useSettingStore, SETTING_DEFAULTS, codeToToken } from '../store/settingStore'
import AppShell from '../components/AppShell'
import Icon from '../components/ui/Icon'

const TABS = [
    { id: 'profile',  icon: User,     label: 'پروفایل' },
    { id: 'settings', icon: Settings, label: 'تنظیمات' },
    { id: 'wallet',   icon: Wallet,   label: 'کیف پول',  soon: true },
    { id: 'assets',   icon: Package,  label: 'دارایی‌ها', soon: true },
    { id: 'ranking',  icon: Trophy,   label: 'رنکینگ',   soon: true },
]

export default function ProfilePage() {
    const { user, updateUser } = useAuthStore()
    const { connected, ip, reconnecting } = useNetbirdStore()
    const { toast } = useNotificationStore()
    const { settings, update: updateSetting } = useSettingStore()

    const [tab, setTab] = useState('profile')
    const [avatarPreview,  setAvatarPreview]  = useState(user?.avatarUrl ?? null)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const fileInputRef = useRef(null)

    const username = user?.username ?? '—'
    const email = user?.email ?? '—'

    async function handleAvatarChange(e) {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast('فقط فایل تصویری مجاز است', 'error')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast('حجم فایل نباید بیشتر از ۵ مگابایت باشد', 'error')
            return
        }

        const preview = URL.createObjectURL(file)
        setAvatarPreview(prev => { if (prev && !prev.startsWith('http')) URL.revokeObjectURL(prev); return preview })
        setAvatarUploading(true)
        try {
            const { data } = await uploadAPI.avatar(file)
            setAvatarPreview(data.url)
            // آواتار رو در auth store هم آپدیت کن تا همه‌جا (مثل sidebar) بلافاصله عوض شه
            updateUser({ ...useAuthStore.getState().user, avatarUrl: data.url })
            toast('تصویر پروفایل با موفقیت ذخیره شد', 'success')
        } catch {
            toast('خطا در آپلود تصویر', 'error')
            setAvatarPreview(user?.avatarUrl ?? null)
        } finally {
            setAvatarUploading(false)
        }
    }

    async function handlePasswordSubmit(e) {
        e.preventDefault()
        setPasswordError('')

        if (passwordForm.next !== passwordForm.confirm) {
            setPasswordError('رمز عبور جدید با تکرار آن یکسان نیست')
            return
        }
        if (passwordForm.next.length < 6) {
            setPasswordError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد')
            return
        }

        setPasswordLoading(true)
        try {
            await authAPI.changePassword(passwordForm.current, passwordForm.next)
            toast('رمز عبور با موفقیت تغییر یافت', 'success')
            setPasswordForm({ current: '', next: '', confirm: '' })
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'خطا در تغییر رمز عبور')
        } finally {
            setPasswordLoading(false)
        }
    }

    function handleTabClick(item) {
        if (item.soon) return
        setTab(item.id)
    }

    return (
        <AppShell>
            <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
                <nav className="flex-shrink-0 flex items-stretch h-12 border-b border-og">
                    {TABS.map(item => {
                        const active = tab === item.id
                        const tabClass = `flex items-center gap-2 px-4 h-full text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                            active
                                ? 'text-og-accent border-og-primary opacity-100'
                                : 'text-og-muted border-transparent opacity-40'
                        }`

                        if (item.soon) {
                            return (
                                <span
                                    key={item.id}
                                    aria-disabled="true"
                                    className={`${tabClass} opacity-35 cursor-not-allowed select-none`}>
                                    <Icon icon={item.icon} size="sm" />
                                    <span>{item.label}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-og-primary-dim border border-og-primary/30 text-og-muted font-medium leading-none">
                                        به‌زودی
                                    </span>
                                </span>
                            )
                        }

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleTabClick(item)}
                                className={`${tabClass} hover:opacity-65`}>
                                <Icon icon={item.icon} size="sm" />
                                <span>{item.label}</span>
                            </button>
                        )
                    })}
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-6 pr-4 space-y-4">
                    {tab === 'settings' && (
                        <HotkeySettings
                            settings={settings}
                            onUpdate={updateSetting}
                            toast={toast}
                        />
                    )}

                    {tab === 'profile' && (
                        <>
                            <ProfileHero
                                username={username}
                                avatarPreview={avatarPreview}
                                avatarUploading={avatarUploading}
                                connected={connected}
                                reconnecting={reconnecting}
                                ip={ip}
                                onAvatarClick={() => !avatarUploading && fileInputRef.current?.click()}
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />

                            <section className="og-card rounded-xl p-5 space-y-4">
                                <h2 className="og-title text-base text-og-body">اطلاعات پروفایل</h2>
                                <div className="space-y-3">
                                    <Field label="نام کاربری" value={username} mono />
                                    <Field label="ایمیل" value={email} mono ltr />
                                </div>
                            </section>

                            <section className="og-card rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Icon icon={Lock} size="md" className="text-og-accent" />
                                    <h2 className="og-title text-base text-og-body">تغییر رمز عبور</h2>
                                </div>
                                <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
                                    <div className="space-y-1">
                                        <label className="og-label text-og-muted text-[11px]">رمز فعلی</label>
                                        <input
                                            type="password"
                                            className="og-input ltr w-full"
                                            autoComplete="current-password"
                                            value={passwordForm.current}
                                            onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                                            placeholder="••••••••"
                                            disabled={passwordLoading}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="og-label text-og-muted text-[11px]">رمز جدید</label>
                                        <input
                                            type="password"
                                            className="og-input ltr w-full"
                                            autoComplete="new-password"
                                            value={passwordForm.next}
                                            onChange={e => setPasswordForm(f => ({ ...f, next: e.target.value }))}
                                            placeholder="••••••••"
                                            disabled={passwordLoading}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="og-label text-og-muted text-[11px]">تکرار رمز جدید</label>
                                        <input
                                            type="password"
                                            className="og-input ltr w-full"
                                            autoComplete="new-password"
                                            value={passwordForm.confirm}
                                            onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                                            placeholder="••••••••"
                                            disabled={passwordLoading}
                                        />
                                    </div>
                                    {passwordError && (
                                        <div className="md:col-span-3 rounded-lg og-error-box p-3 text-xs">
                                            {passwordError}
                                        </div>
                                    )}
                                    <div className="md:col-span-3 flex justify-end pt-1">
                                        <button
                                            type="submit"
                                            disabled={passwordLoading || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
                                            className="og-btn-primary px-6 py-2">
                                            {passwordLoading ? 'در حال ذخیره...' : 'ذخیره رمز عبور'}
                                        </button>
                                    </div>
                                </form>
                            </section>
                        </>
                    )}

                    {tab !== 'profile' && tab !== 'settings' && (
                        <ComingSoonPanel tab={TABS.find(t => t.id === tab)} />
                    )}
                </div>
            </div>
        </AppShell>
    )
}

function ProfileHero({ username, avatarPreview, avatarUploading, connected, reconnecting, ip, onAvatarClick }) {
    const initial = username?.[0]?.toUpperCase() ?? '?'
    const statusLabel = connected ? 'آنلاین' : reconnecting ? 'در حال اتصال مجدد...' : 'آفلاین'

    return (
        <div className="og-card rounded-xl p-5 flex items-start gap-5">
            <div className="flex-1 min-w-0 space-y-2 text-right">
                <h2 className="og-title text-xl text-og-body truncate">{username}</h2>
                <p className="text-og-muted text-sm font-mono ltr truncate">@{username}</p>
                <div className="flex items-center justify-start gap-3 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-og-muted text-xs">
                        <span className={connected ? 'status-online' : 'status-offline'} />
                        {statusLabel}
                    </span>
                </div>
                {ip && (
                    <div className="flex items-center justify-start gap-1.5 pt-0.5">
                        <span className="og-label text-og-muted text-[11px]">آی‌پی شبکه:</span>
                        <span className="text-og-body text-xs font-mono ltr">{ip}</span>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onAvatarClick}
                disabled={avatarUploading}
                className="relative group shrink-0 disabled:cursor-default"
                title="تغییر تصویر پروفایل">
                <div className="w-24 h-24 og-avatar-ring overflow-hidden">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="og-title font-bold text-2xl text-og-accent">{initial}</span>
                    )}
                </div>
                {avatarUploading ? (
                    <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </span>
                ) : (
                    <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Icon icon={Camera} size="md" className="text-white" />
                    </span>
                )}
            </button>
        </div>
    )
}

function Field({ label, value, mono, ltr }) {
    return (
        <div className="space-y-1">
            <div className="og-label text-og-muted text-[11px]">{label}</div>
            <div className={`text-sm text-og-body ${mono ? 'font-mono' : ''} ${ltr ? 'ltr text-left' : ''}`}>
                {value}
            </div>
        </div>
    )
}

const HOTKEY_ROWS = [
    { key: 'hotkey.voice.mute',     label: 'قطع/وصل میکروفون',   hint: 'در حالت همیشه روشن' },
    { key: 'hotkey.voice.ptt',      label: 'فشار برای صحبت (PTT)', hint: 'نگه داشتن کلید' },
    { key: 'hotkey.overlay.toggle', label: 'باز/بستن اورلی',       hint: 'کلید جهانی در بازی' },
]

function HotkeySettings({ settings, onUpdate, toast }) {
    const [saving, setSaving] = useState(null)

    async function handleChange(key, value) {
        setSaving(key)
        try {
            await onUpdate(key, value)
            toast('میانبر ذخیره شد', 'success', 2000)
        } catch {
            toast('خطا در ذخیره میانبر', 'error')
        } finally {
            setSaving(null)
        }
    }

    return (
        <section className="og-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Icon icon={Keyboard} size="md" className="text-og-accent" />
                <h2 className="og-title text-base text-og-body">کلیدهای میانبر</h2>
            </div>
            <p className="text-og-muted text-xs">
                برای تغییر هر کلید، روی آن کلیک کنید و کلید مورد نظر را فشار دهید.
            </p>
            <div className="space-y-3 max-w-lg">
                {HOTKEY_ROWS.map(row => (
                    <div key={row.key} className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-og-body text-sm">{row.label}</div>
                            <div className="text-og-muted text-[11px]">{row.hint}</div>
                        </div>
                        <HotkeyInput
                            value={settings[row.key] ?? SETTING_DEFAULTS[row.key]}
                            disabled={saving === row.key}
                            onConfirm={value => handleChange(row.key, value)}
                        />
                    </div>
                ))}
            </div>
        </section>
    )
}

function ComingSoonPanel({ tab }) {
    if (!tab) return null

    return (
        <div className="flex flex-col items-center justify-center text-center py-16">
            <Icon icon={tab.icon} size="lg" className="text-og-accent opacity-50 mb-4" />
            <h2 className="og-title text-lg text-og-body">{tab.label}</h2>
            <p className="text-og-muted text-sm mt-2 max-w-sm">
                این بخش در نسخه‌های بعدی اضافه می‌شود.
            </p>
        </div>
    )
}

function HotkeyInput({ value, disabled, onConfirm }) {
    const [recording, setRecording] = useState(false)
    const [draft,     setDraft]     = useState(value)

    useEffect(() => { setDraft(value) }, [value])

    const startRecording = useCallback(() => {
        if (disabled) return
        setRecording(true)
    }, [disabled])

    useEffect(() => {
        if (!recording) return

        function onKeyDown(e) {
            e.preventDefault()
            e.stopPropagation()

            if (e.key === 'Escape') { setRecording(false); setDraft(value); return }

            const parts = []
            if (e.ctrlKey)  parts.push('Ctrl')
            if (e.altKey)   parts.push('Alt')
            if (e.shiftKey) parts.push('Shift')

            // Record the PHYSICAL key (e.code) so numpad keys are distinct from the
            // top row and survive NumLock state; ignore lone modifier presses.
            const code = e.code
            if (/^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(code)) return

            parts.push(codeToToken(code))

            const combo = parts.join('+')
            setDraft(combo)
            setRecording(false)
            onConfirm(combo)
        }

        window.addEventListener('keydown', onKeyDown, { capture: true })
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
    }, [recording, value, onConfirm])

    return (
        <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`flex-shrink-0 min-w-[110px] text-center font-mono text-sm px-3 py-1.5 rounded-lg border transition-all ${
                recording
                    ? 'border-og-primary bg-og-primary-dim text-og-accent animate-pulse'
                    : disabled
                        ? 'border-og opacity-50 cursor-default bg-og-panel text-og-muted'
                        : 'border-og bg-og-panel text-og-body hover:border-og-primary cursor-pointer'
            }`}>
            {recording ? 'ضبط...' : (disabled ? '...' : draft)}
        </button>
    )
}

