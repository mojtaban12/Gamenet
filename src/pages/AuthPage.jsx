import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authAPI } from '../api'
import { useAuthStore } from '../store/authStore'
import appIcon from '../../assets/icon-256.png'

export default function AuthPage() {
    const { t } = useTranslation()
    // mode: 'login' | 'register' | 'forgot' | 'reset'
    const [mode, setMode] = useState('login')
    const [form, setForm] = useState({ username: '', email: '', password: '' })
    const [resetForm, setResetForm] = useState({ token: '', newPassword: '' })
    const [resetEmail, setResetEmail] = useState('')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [loading, setLoading] = useState(false)

    const login = useAuthStore(s => s.login)
    const token = useAuthStore(s => s.token)
    const navigate = useNavigate()

    useEffect(() => {
        if (token) navigate('/home', { replace: true })
    }, [token, navigate])

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    const setReset = (k) => (e) => setResetForm(f => ({ ...f, [k]: e.target.value }))

    const clearMessages = () => { setError(''); setInfo('') }

    const handleSubmit = async () => {
        clearMessages()
        setLoading(true)
        try {
            let res
            if (mode === 'login') {
                res = await authAPI.login({ email: form.email, password: form.password })
            } else {
                if (!form.username.trim()) { setError(t('auth.usernameRequired')); setLoading(false); return }
                res = await authAPI.register(form)
            }
            await login(res.data.token, res.data.user)
            navigate('/home')
        } catch (err) {
            if (!err.response) {
                // Global interceptor already showed a toast — echo it inline so the form also reacts
                setError(t('auth.connectionError'))
            } else {
                setError(err.response.data?.message || t('auth.serverError'))
            }
        } finally {
            setLoading(false)
        }
    }

    const handleForgot = async () => {
        clearMessages()
        if (!resetEmail.trim()) { setError(t('auth.emailRequired')); return }
        setLoading(true)
        try {
            await authAPI.forgotPassword(resetEmail.trim())
            // Stay on 'forgot' page and show the info — the user must receive the email
            // before we let them proceed to the reset form.
            setInfo(t('auth.forgotSentInfo'))
        } catch (err) {
            if (!err.response) {
                setError(t('auth.connectionError'))
            } else {
                setError(err.response.data?.message || t('auth.serverError'))
            }
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        clearMessages()
        if (!resetForm.token.trim()) { setError(t('auth.resetCodeRequired')); return }
        if (!resetForm.newPassword) { setError(t('auth.newPasswordRequired')); return }
        if (resetForm.newPassword.length < 6) { setError(t('auth.passwordMinLength')); return }
        setLoading(true)
        try {
            await authAPI.resetPassword(resetEmail.trim(), resetForm.token.trim(), resetForm.newPassword)
            setInfo(t('auth.resetSuccess'))
            setMode('login')
            setForm(f => ({ ...f, email: resetEmail.trim(), password: '' }))
        } catch (err) {
            setError(err.response?.data?.message || t('auth.invalidOrExpiredCode'))
        } finally {
            setLoading(false)
        }
    }

    const goToLogin = () => { clearMessages(); setMode('login') }

    return (
        <div className="flex-1 og-page og-ambient flex items-center justify-center p-6">
            <div className="og-content w-full max-w-md">
                <div className="og-panel px-8 pt-5 pb-8">
                    <div className="text-center mb-6">
                        <img
                            src={appIcon}
                            alt="TarGame"
                            className="w-28 h-28 mx-auto object-contain scale-110 -my-1"
                            draggable={false}
                        />
                        <h1 className="og-title text-3xl text-og-accent mt-2">TarGame</h1>
                        <p className="text-sm text-og-muted mt-2">{t('auth.subtitle')}</p>
                    </div>

                    {/* Tab bar — only show for login/register */}
                    {(mode === 'login' || mode === 'register') && (
                        <div className="flex og-card p-1 mb-5">
                            {['login', 'register'].map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setMode(m); clearMessages() }}
                                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${mode === m
                                        ? 'og-tab-active'
                                        : 'og-tab-inactive hover:text-og-body'
                                    }`}>
                                    {m === 'login' ? t('auth.tabLogin') : t('auth.tabRegister')}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Login / Register ── */}
                    {(mode === 'login' || mode === 'register') && (
                        <form
                            className="space-y-3"
                            autoComplete="on"
                            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
                        >
                            {mode === 'register' && (
                                <input
                                    className="og-input ltr"
                                    name="username"
                                    autoComplete="username"
                                    placeholder="Username"
                                    value={form.username}
                                    onChange={set('username')}
                                />
                            )}
                            <input
                                className="og-input ltr"
                                type="email"
                                name="email"
                                autoComplete={mode === 'login' ? 'username' : 'email'}
                                placeholder="Email"
                                value={form.email}
                                onChange={set('email')}
                            />
                            <input
                                className="og-input ltr"
                                type="password"
                                name="password"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                placeholder="Password"
                                value={form.password}
                                onChange={set('password')}
                            />

                            {error && <div className="rounded-lg og-error-box p-3 text-xs">{error}</div>}
                            {info  && <div className="rounded-lg og-card p-3 text-xs text-og-accent">{info}</div>}

                            <button
                                type="submit"
                                disabled={loading || !form.email || !form.password}
                                className="og-btn-primary w-full mt-3"
                            >
                                {loading
                                    ? (mode === 'login' ? t('auth.loggingIn') : t('auth.registering'))
                                    : (mode === 'login' ? t('auth.loginSubmit') : t('auth.registerSubmit'))}
                            </button>

                            {mode === 'login' && (
                                <p
                                    className="text-center text-[11px] text-og-accent mt-2 cursor-pointer hover:underline select-none"
                                    onClick={() => { clearMessages(); setResetEmail(form.email); setMode('forgot') }}
                                >
                                    {t('auth.forgotPassword')}
                                </p>
                            )}
                        </form>
                    )}

                    {/* ── Forgot Password — enter email ── */}
                    {mode === 'forgot' && (
                        <form
                            className="space-y-3"
                            onSubmit={(e) => { e.preventDefault(); info ? setMode('reset') : handleForgot() }}
                        >
                            <p className="text-sm text-og-muted text-center mb-4">
                                {t('auth.forgotEmailPrompt')}
                            </p>
                            <input
                                className="og-input ltr"
                                type="email"
                                placeholder="Email"
                                value={resetEmail}
                                onChange={(e) => { setResetEmail(e.target.value); if (info) clearMessages() }}
                                autoFocus={!info}
                                disabled={!!info}
                            />

                            {error && <div className="rounded-lg og-error-box p-3 text-xs">{error}</div>}
                            {info  && <div className="rounded-lg og-card p-3 text-xs text-og-accent">{info}</div>}

                            {!info ? (
                                <button
                                    type="submit"
                                    disabled={loading || !resetEmail.trim()}
                                    className="og-btn-primary w-full mt-3"
                                >
                                    {loading ? t('auth.sending') : t('auth.sendRecoveryCode')}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="submit"
                                        className="og-btn-primary w-full mt-3"
                                    >
                                        {t('auth.receivedCodeContinue')}
                                    </button>
                                    <p
                                        className="text-center text-[11px] text-og-accent mt-1 cursor-pointer hover:underline select-none"
                                        onClick={() => clearMessages()}
                                    >
                                        {t('auth.resendToOtherEmail')}
                                    </p>
                                </>
                            )}
                            <p
                                className="text-center text-[11px] text-og-muted mt-2 cursor-pointer hover:text-og-body select-none"
                                onClick={goToLogin}
                            >
                                {t('auth.backToLogin')}
                            </p>
                        </form>
                    )}

                    {/* ── Reset Password — enter code + new password ── */}
                    {mode === 'reset' && (
                        <form
                            className="space-y-3"
                            onSubmit={(e) => { e.preventDefault(); handleReset() }}
                        >
                            {info && <div className="rounded-lg og-card p-3 text-xs text-og-accent mb-1">{info}</div>}
                            <input
                                className="og-input ltr text-center tracking-widest text-lg"
                                placeholder={t('auth.codePlaceholder')}
                                maxLength={6}
                                value={resetForm.token}
                                onChange={setReset('token')}
                                autoFocus
                            />
                            <input
                                className="og-input ltr"
                                type="password"
                                placeholder={t('auth.newPasswordPlaceholder')}
                                autoComplete="new-password"
                                value={resetForm.newPassword}
                                onChange={setReset('newPassword')}
                            />

                            {error && <div className="rounded-lg og-error-box p-3 text-xs">{error}</div>}

                            <button
                                type="submit"
                                disabled={loading || !resetForm.token || !resetForm.newPassword}
                                className="og-btn-primary w-full mt-3"
                            >
                                {loading ? t('auth.changingPassword') : t('auth.changePassword')}
                            </button>
                            <p
                                className="text-center text-[11px] text-og-muted mt-2 cursor-pointer hover:text-og-body select-none"
                                onClick={() => { clearMessages(); setMode('forgot') }}
                            >
                                {t('auth.resendCode')}
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
