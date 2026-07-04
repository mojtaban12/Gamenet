import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff, ChevronDown, RefreshCw } from 'lucide-react'
import { useVoiceStore } from '../store/voiceStore'
import { useSettingStore, parseHotkey, SETTING_DEFAULTS } from '../store/settingStore'
import Icon from './ui/Icon'

function matchesHotkey(e, hk) {
    return e.code === hk.code && !!e.ctrlKey === !!hk.ctrl && !!e.shiftKey === !!hk.shift && !!e.altKey === !!hk.alt
}

export default function VoiceControls({ groupId, userId }) {
    const { t } = useTranslation()
    const {
        connected, connecting, micEnabled, speakingIds,
        micMode, pttActive,
        connect, reconnect, toggleMic, setMicMode, startPtt, stopPtt,
    } = useVoiceStore()

    const settings = useSettingStore(s => s.settings)
    // Memoize so these stay referentially stable across renders. They feed the
    // keyboard effect's dependency array; if recreated every render, the effect
    // tears down on each render and its cleanup's stopPtt() cancels PTT the
    // instant startPtt() triggers a re-render — i.e. push-to-talk never engages.
    const pttSetting  = settings['hotkey.voice.ptt']  ?? SETTING_DEFAULTS['hotkey.voice.ptt']
    const muteSetting = settings['hotkey.voice.mute'] ?? SETTING_DEFAULTS['hotkey.voice.mute']
    const pttHk  = useMemo(() => parseHotkey(pttSetting),  [pttSetting])
    const muteHk = useMemo(() => parseHotkey(muteSetting), [muteSetting])

    const [showMenu, setShowMenu] = useState(false)
    const [menuPos,  setMenuPos]  = useState(null)
    const menuRef    = useRef(null)
    const menuBtnRef = useRef(null)

    const speaking = micEnabled && userId && speakingIds.includes(userId)
    const isPtt    = micMode === 'push-to-talk'

    // ─── keyboard hotkeys ────────────────────────────────────────────────────
    useEffect(() => {
        if (!connected) return

        function onKeyDown(e) {
            if (e.repeat) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return

            if (isPtt && matchesHotkey(e, pttHk)) {
                e.preventDefault()
                startPtt()
                return
            }
            if (!isPtt && matchesHotkey(e, muteHk)) {
                e.preventDefault()
                toggleMic()
            }
        }

        function onKeyUp(e) {
            if (isPtt && e.code === pttHk.code) stopPtt()
        }

        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup',   onKeyUp)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('keyup',   onKeyUp)
            stopPtt()
        }
    }, [connected, isPtt, pttHk, muteHk, startPtt, stopPtt, toggleMic])

    // ─── بستن منو با کلیک بیرون ─────────────────────────────────────────────
    useEffect(() => {
        if (!showMenu) return
        function onMouseDown(e) {
            if (menuBtnRef.current?.contains(e.target)) return   // toggle خود دکمه
            if (!menuRef.current?.contains(e.target)) setShowMenu(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [showMenu])

    function openMenu() {
        if (!menuBtnRef.current) return
        const rect = menuBtnRef.current.getBoundingClientRect()
        setMenuPos({ top: rect.bottom + 6, left: rect.left })
        setShowMenu(s => !s)
    }

    async function handleMicClick() {
        if (!connected) { await connect(groupId); return }
        if (!isPtt) await toggleMic()
    }

    const micOn   = connected && micEnabled
    const pttHeld = isPtt && pttActive
    const pulsing = pttHeld || (speaking && !isPtt)

    return (
        <div className="flex items-center gap-0.5 no-drag">
            {/* ─── دکمه میکروفون ─── */}
            <button
                type="button"
                disabled={connecting || (connected && isPtt)}
                onClick={handleMicClick}
                title={
                    !connected       ? t('voice.join')                          :
                    isPtt && pttHeld ? t('voice.speaking')                       :
                    isPtt            ? t('voice.holdKey', { key: pttHk.label })  :
                    micOn            ? t('voice.muteMic')                        : t('voice.unmuteMic')
                }
                className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:cursor-default ${
                    pttHeld
                        ? 'bg-gn-green/20 text-gn-green ring-2 ring-gn-green'
                        : micOn
                            ? 'bg-gn-green/15 text-gn-green'
                            : 'bg-og-subtle text-og-muted hover:text-og-body'
                } ${pulsing ? 'animate-pulse' : ''}`}>
                {connecting
                    ? <span className="w-4 h-4 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin" />
                    : <Icon icon={micOn ? Mic : MicOff} size="sm" />
                }
                {isPtt && connected && (
                    <span className="absolute -bottom-1 -end-1 font-mono text-[7px] font-bold bg-gn-surface border border-gn-border rounded px-0.5 text-og-muted leading-tight select-none">
                        {pttHk.label}
                    </span>
                )}
            </button>

            {/* ─── دکمه باز کردن منو ─── */}
            <button
                ref={menuBtnRef}
                type="button"
                onClick={openMenu}
                title={t('voice.micModeTitle')}
                className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
                    showMenu
                        ? 'bg-og-hover text-og-body'
                        : 'text-og-muted hover:text-og-body hover:bg-og-hover'
                }`}>
                <Icon icon={ChevronDown} size={11} />
            </button>

            {/* ─── منو — با portal از overflow-hidden فرار می‌کنه ─── */}
            {showMenu && menuPos && createPortal(
                <div
                    ref={menuRef}
                    style={{ top: menuPos.top, left: menuPos.left }}
                    className="fixed z-[9999] bg-gn-surface border border-gn-border rounded-xl shadow-2xl py-1 w-52">
                    {[
                        { key: 'always-on',    label: t('voice.alwaysOn'),    sub: t('voice.alwaysOnSub'),    hotkey: muteHk.label },
                        { key: 'push-to-talk', label: t('voice.pushToTalk'), sub: t('voice.pushToTalkSub'), hotkey: pttHk.label  },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => { setMicMode(opt.key); setShowMenu(false) }}
                            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-og-hover transition-colors">
                            <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
                                micMode === opt.key ? 'border-gn-accent' : 'border-og-muted'
                            }`}>
                                {micMode === opt.key && <span className="w-2 h-2 rounded-full bg-gn-accent" />}
                            </span>

                            <div className="flex-1 min-w-0">
                                <div className="text-og-body text-xs font-medium text-start">{opt.label}</div>
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className="text-og-muted text-[10px]">{opt.sub}</span>
                                    <kbd className="inline-flex items-center px-1 py-px bg-og-panel border border-og rounded text-[9px] font-mono text-og-muted leading-none">
                                        {opt.hotkey}
                                    </kbd>
                                </div>
                            </div>
                        </button>
                    ))}

                    {/* ─── اتصال مجدد وویس ─── */}
                    <div className="my-1 border-t border-gn-border" />
                    <button
                        type="button"
                        disabled={connecting}
                        onClick={() => { setShowMenu(false); reconnect(groupId, userId) }}
                        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-og-hover transition-colors disabled:opacity-50 disabled:cursor-default">
                        <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-og-muted">
                            <Icon icon={RefreshCw} size={13} className={connecting ? 'animate-spin' : ''} />
                        </span>
                        <div className="flex-1 min-w-0 text-start">
                            <div className="text-og-body text-xs font-medium">{t('voice.reconnectVoice')}</div>
                            <div className="text-og-muted text-[10px] mt-0.5">
                                {connecting ? t('common.connecting') : connected ? t('voice.reconnectHintBroken') : t('voice.reconnectHintDefault')}
                            </div>
                        </div>
                    </button>
                </div>,
                document.body
            )}
        </div>
    )
}
