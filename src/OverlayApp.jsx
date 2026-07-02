import { useState, useEffect, useRef } from 'react'
import { X, MessageCircle, Users, Mic, MicOff, Volume2, Copy, Check } from 'lucide-react'
import ChatTextarea from './components/ChatTextarea'
import { parseHotkey } from './store/settingStore'

export default function OverlayApp() {
    const [visible, setVisible] = useState(false)
    const [state, setState] = useState(null)
    const [input, setInput] = useState('')
    const [ipCopied, setIpCopied] = useState(false)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        window.overlayElectron?.onState((s) => setState(s))
        window.overlayElectron?.onVisibility((v) => setVisible(v))
    }, [])

    useEffect(() => {
        if (visible && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [state?.messages, visible])

    // Escape to close
    useEffect(() => {
        if (!visible) return
        const onKey = (e) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [visible])

    // PTT keyboard — fires when overlay is focused
    useEffect(() => {
        const { voiceConnected, micMode, pttHotkey } = state || {}
        if (!visible || !voiceConnected || micMode !== 'push-to-talk') return

        const { code, ctrl } = parseHotkey(pttHotkey ?? 'U')

        function onKeyDown(e) {
            if (e.repeat || e.code !== code || !!e.ctrlKey !== ctrl) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            e.preventDefault()
            window.overlayElectron?.voiceAction('startPtt')
        }
        function onKeyUp(e) {
            if (e.code === code) window.overlayElectron?.voiceAction('stopPtt')
        }

        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('keyup', onKeyUp)
            window.overlayElectron?.voiceAction('stopPtt')
        }
    }, [visible, state?.voiceConnected, state?.micMode, state?.pttHotkey])

    function close() {
        window.overlayElectron?.close()
    }

    function sendMessage() {
        const text = input.trim()
        if (!text || !state?.connected) return
        window.overlayElectron?.sendMessage(text)
        setInput('')
    }

    function handleVoiceMicClick() {
        if (!state?.voiceConnected) {
            window.overlayElectron?.voiceAction('connect', { groupId: state?.groupId })
        } else if (state?.micMode !== 'push-to-talk') {
            window.overlayElectron?.voiceAction('toggleMic')
        }
    }

    function toggleVoiceMode() {
        const next = state?.micMode === 'push-to-talk' ? 'always-on' : 'push-to-talk'
        window.overlayElectron?.voiceAction('setMicMode', { mode: next })
    }

    if (!visible || !state) return null

    const {
        groupName, groupId, members = [], myIp, user, messages = [], connected,
        voiceConnected = false, voiceConnecting = false,
        micEnabled = false, micMode = 'always-on', pttActive = false,
        speakingIds = [], participantIds = [],
        activeIp = null, lobbyPlaying = false, selectedGameType = null,
    } = state

    function copyIp() {
        if (!activeIp) return
        navigator.clipboard.writeText(activeIp).catch(() => {})
        setIpCopied(true)
        setTimeout(() => setIpCopied(false), 2000)
    }

    const isPtt = micMode === 'push-to-talk'
    const micOn = voiceConnected && micEnabled

    return (
        <div className="fixed inset-0 flex justify-end" style={{ direction: 'rtl' }}>
            {/* click outside → close */}
            <div className="flex-1" onClick={close} />

            {/* panel */}
            <div
                className="h-full flex flex-col no-drag"
                style={{
                    width: '380px',
                    background: 'rgba(10,10,18,0.88)',
                    backdropFilter: 'blur(18px)',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
                }}>

                {/* ── Header ── */}
                <div
                    className="px-4 py-3 shrink-0 flex items-center justify-between gap-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-400' : 'bg-gray-500'}`}
                                style={connected ? { boxShadow: '0 0 6px #22c55e' } : {}}
                            />
                            <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--og-primary)' }}>
                                {groupName || groupId || 'لابی'}
                            </h2>
                        </div>
                        {activeIp && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[11px] ltr" style={{ color: 'var(--og-text)', opacity: 0.7 }}>
                                    {activeIp}
                                </span>
                                <button
                                    type="button"
                                    onClick={copyIp}
                                    title="کپی IP"
                                    className="flex items-center justify-center w-4 h-4 rounded transition-colors"
                                    style={{ color: ipCopied ? '#22c55e' : 'var(--og-muted)' }}
                                    onMouseEnter={e => { if (!ipCopied) e.currentTarget.style.color = 'var(--og-text)' }}
                                    onMouseLeave={e => { if (!ipCopied) e.currentTarget.style.color = 'var(--og-muted)' }}>
                                    {ipCopied ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        title="بستن (Esc)"
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
                        style={{ color: 'var(--og-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--og-text)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--og-muted)' }}>
                        <X size={14} />
                    </button>
                </div>

                {/* ── Members ── */}
                <div className="shrink-0" style={{ maxHeight: '35%' }}>
                    <div className="px-4 py-2 flex items-center gap-1.5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <Users size={12} style={{ color: 'var(--og-muted)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--og-muted)' }}>
                            اعضا · {members.length}
                        </span>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                        {members.map((m, i) => {
                            const isMe = m.userId === user?.id?.toString()
                            const inVoice = participantIds.includes(m.userId?.toString())
                            const isSpeaking = speakingIds.includes(m.userId?.toString())
                            const mIp = selectedGameType === 2 ? m.ip : m.tincIp
                            return (
                                <div key={m.peerId || m.userId || i}
                                    className="px-4 py-2"
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    {/* ردیف اول: آواتار + نام */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative shrink-0">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                                                style={{
                                                    background: isSpeaking ? 'rgba(34,197,94,0.2)' : 'rgba(0,218,243,0.12)',
                                                    color: isSpeaking ? '#22c55e' : 'var(--og-primary)',
                                                    outline: isSpeaking ? '1.5px solid #22c55e' : 'none',
                                                }}>
                                                {(m.username || '?')[0].toUpperCase()}
                                            </div>
                                            {inVoice && (
                                                <span
                                                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border"
                                                    style={{
                                                        background: isSpeaking ? '#22c55e' : '#6b7280',
                                                        borderColor: 'rgba(10,10,18,0.88)',
                                                        boxShadow: isSpeaking ? '0 0 5px #22c55e' : 'none',
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <span className="text-xs font-medium truncate flex-1"
                                            style={{ color: isSpeaking ? '#22c55e' : 'var(--og-text)' }}>
                                            {m.username || m.peerId?.substring(0, 10) || '?'}
                                            {isMe && (
                                                <span className="text-[10px] mr-1" style={{ color: 'var(--og-primary)' }}>شما</span>
                                            )}
                                        </span>
                                    </div>
                                    {/* ردیف دوم: آی‌پی */}
                                    {mIp && (
                                        <div className="font-mono text-[10px] ltr mt-1 pr-8"
                                            style={{ color: 'var(--og-primary)', opacity: 0.75 }}>
                                            {mIp}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── Voice Controls ── */}
                <div
                    className="shrink-0 px-4 py-2 flex items-center gap-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Volume2 size={12} style={{ color: 'var(--og-muted)' }} />
                    <span className="text-[11px] flex-1" style={{ color: 'var(--og-muted)' }}>
                        وویس{participantIds.length > 0 ? ` · ${participantIds.length} نفر` : ''}
                    </span>

                    {/* Mic / Join button */}
                    <button
                        type="button"
                        onClick={handleVoiceMicClick}
                        disabled={voiceConnecting || (voiceConnected && isPtt)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                        style={
                            pttActive
                                ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', outline: '1px solid #22c55e' }
                                : micOn
                                    ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                                    : voiceConnected
                                        ? { background: 'rgba(255,255,255,0.06)', color: 'var(--og-muted)' }
                                        : { background: 'rgba(0,218,243,0.1)', color: 'var(--og-primary)' }
                        }
                        title={
                            !voiceConnected ? 'پیوستن به وویس' :
                            isPtt ? 'نگه دار U برای صحبت' :
                            micOn ? 'قطع میکروفون' : 'روشن کردن میکروفون'
                        }>
                        {voiceConnecting
                            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            : micOn ? <Mic size={11} /> : <MicOff size={11} />
                        }
                        <span>
                            {!voiceConnected ? 'پیوستن' :
                             isPtt ? 'U = صحبت' :
                             micOn ? 'روشن' : 'قطع'}
                        </span>
                    </button>

                    {/* Mode toggle */}
                    {voiceConnected && (
                        <button
                            type="button"
                            onClick={toggleVoiceMode}
                            className="px-2 py-1 rounded text-[10px] transition-colors"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--og-muted)' }}
                            title={isPtt ? 'حالت فشار برای صحبت — کلیک برای تغییر' : 'حالت همیشه روشن — کلیک برای تغییر'}>
                            {isPtt ? 'PTT' : 'VA'}
                        </button>
                    )}
                </div>

                {/* ── Chat ── */}
                <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="px-4 py-2 shrink-0 flex items-center gap-1.5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <MessageCircle size={12} style={{ color: 'var(--og-muted)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--og-muted)' }}>چت لابی</span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
                        {messages.length === 0 ? (
                            <div className="text-center py-6 text-[11px] opacity-40" style={{ color: 'var(--og-muted)' }}>
                                پیامی نیست
                            </div>
                        ) : messages.slice(-50).map((msg, i) => (
                            msg.system ? (
                                <div key={msg.id || i} className="text-center">
                                    <span className="text-[10px]" style={{ color: 'var(--og-muted)' }}>{msg.message}</span>
                                </div>
                            ) : (
                                <div key={msg.id || i}>
                                    <span className="text-[10px]" style={{ color: 'var(--og-muted)' }}>
                                        {msg.senderName}:&nbsp;
                                    </span>
                                    <span className="text-xs break-words whitespace-pre-wrap" style={{ color: 'var(--og-text)' }}>
                                        {msg.message}
                                    </span>
                                </div>
                            )
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex gap-2 items-end">
                            <ChatTextarea
                                className="flex-1 min-w-0 rounded px-3 py-2 text-xs outline-none"
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--og-text)',
                                }}
                                placeholder="پیام..."
                                value={input}
                                onChange={setInput}
                                onSend={sendMessage}
                                maxLength={500}
                                disabled={!connected}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--og-primary)' }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                            />
                            <button
                                type="button"
                                onClick={sendMessage}
                                disabled={!input.trim() || !connected}
                                className="px-3 py-2 rounded text-xs font-medium shrink-0 transition-opacity disabled:opacity-40"
                                style={{ background: 'var(--og-primary)', color: '#001a20' }}>
                                ارسال
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
