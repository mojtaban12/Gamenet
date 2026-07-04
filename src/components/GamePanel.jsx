import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Gamepad2, Download } from 'lucide-react'
import { useNetbirdStore } from '../store/netbirdStore'
import { useNotificationStore } from '../store/notificationStore'
import { bringUpMesh } from '../utils/meshNetwork'

const USES_TINC = (gameType) => (gameType ?? 0) !== 2
import { gameAPI, tincAPI } from '../api'
import GameSelectModal from './GameSelectModal'
import StreamButton from './StreamButton'
import { prefetchGameMeta } from '../utils/gameMetaCache'
import Icon from './ui/Icon'
import { useSettingStore } from '../store/settingStore'

export default function GamePanel({ lobbyId, isHost, hub, onMeshActive, onGameStateChange }) {
    const { t } = useTranslation()
    const streamEnabled = useSettingStore(s => s.adminSettings['stream.enabled']) !== 'false'
    const [games, setGames]               = useState([])
    const [customGames, setCustomGames]   = useState([])
    const [selectedGame, setSelected]     = useState(null)
    const [selectedIcon, setSelectedIcon] = useState(null)
    const [showModal, setShowModal]       = useState(false)
    const [phase, setPhase]               = useState('idle') // idle | preparing | launching | playing
    const [prepMsg, setPrepMsg]           = useState('')
    const [lobbyPlaying, setLobbyPlaying] = useState(false)
    // API-locked game info, used to resolve full game when games list loads
    const [apiLockedId, setApiLockedId]   = useState(null)
    const [apiLockedName, setApiLockedName] = useState('')
    const { ip: myIp, setTincIp }          = useNetbirdStore()
    const { toast }                       = useNotificationStore()

    const statePollerRef   = useRef(null)
    // Refs so hub event closures always see current values (avoids stale closure bugs)
    const selectedGameRef  = useRef(null)
    const lobbyPlayingRef  = useRef(false)
    const isHostRef        = useRef(isHost)
    const hubRef           = useRef(hub)
    const lobbyIdRef       = useRef(lobbyId)
    // Which exeName we're currently watching for its OS-level exit event.
    // Set right after a successful launch (or when resuming an already-active
    // game on mount). Cleared once that process's exit event arrives.
    const watchedExeNameRef = useRef(null)

    useEffect(() => { selectedGameRef.current = selectedGame }, [selectedGame])
    useEffect(() => { lobbyPlayingRef.current = lobbyPlaying }, [lobbyPlaying])
    useEffect(() => { isHostRef.current = isHost }, [isHost])
    useEffect(() => { hubRef.current = hub }, [hub])
    useEffect(() => { lobbyIdRef.current = lobbyId }, [lobbyId])
    useEffect(() => { onGameStateChange?.(selectedGame, lobbyPlaying) }, [selectedGame, lobbyPlaying])

    // Load game lists
    useEffect(() => {
        gameAPI.list().then(res => {
            setGames(res.data)
            prefetchGameMeta(res.data)
        }).catch(() => {})
        window.electron?.games.getCustom().then(list => {
            setCustomGames(list)
            prefetchGameMeta(list)
        }).catch(() => {})
    }, [])

    // Fetch lobby state once on mount — no `games` dependency (avoids double-fetch race)
    useEffect(() => {
        tincAPI.getState(lobbyId).then(async (res) => {
            const { lockedGameId, lockedGameName, isPlaying } = res.data
            if (lockedGameId) {
                setApiLockedId(lockedGameId)
                setApiLockedName(lockedGameName)
                // Set a placeholder immediately; full object resolved below when games list loads
                setSelected(prev => prev ?? { id: lockedGameId, name: lockedGameName, isUnknown: true })
                loadIcon({ id: lockedGameId, name: lockedGameName })
            }
            setLobbyPlaying(isPlaying)
            if (isPlaying) {
                const active = await window.electron?.games.getActive().catch(() => null)
                if (active) {
                    setPhase('playing')
                    watchedExeNameRef.current = active.exeName
                }
            }
        }).catch(() => {})
    }, [lobbyId])

    // Single event-driven listener for actual OS-level process exit (see
    // electron/games.js + ipc.js). Replaces the old tasklist-polling monitor —
    // no more false "game closed" on a transient alt-tab, since this only fires
    // when the process handle Node itself spawned truly terminates.
    useEffect(() => {
        if (!window.electron?.games?.onExited) return
        return window.electron.games.onExited(({ exeName }) => {
            if (watchedExeNameRef.current !== exeName) return
            watchedExeNameRef.current = null
            setPhase('idle')
            window.electron?.games.clearActive().catch(() => {})

            // Only the HOST controls lobby-wide playing state.
            // If a non-host member's game closes, the lobby may still be active (host is still playing).
            // Non-host: reset own phase only — show "ورود به بازی" so they can rejoin.
            if (isHostRef.current) {
                setLobbyPlaying(false)
                tincAPI.setPlaying(lobbyIdRef.current, false).catch(() => {})
                hubRef.current?.invoke('NotifyPlaying', lobbyIdRef.current, false).catch(() => {})
            }
        })
    }, [])

    // When the games list loads, upgrade placeholder to full game object
    useEffect(() => {
        if (!apiLockedId || !games.length) return
        const found = games.find(g => g.id === apiLockedId)
        if (!found) return
        setSelected(prev => (prev?.id === apiLockedId && prev?.isUnknown) ? found : prev)
        loadIcon(found)
    }, [games, apiLockedId])

    // Hub event subscriptions
    useEffect(() => {
        if (!hub) return

        const onSelected = (data) => {
            const game = games.find(g => g.id === data.gameId)
            if (game) { setSelected(game); loadIcon(game) }
            else { setSelected({ id: data.gameId, name: data.gameName, isUnknown: true }); setSelectedIcon(null) }
        }

        const onStart = async (data) => {
            setLobbyPlaying(true)
            if (isHost) return
            let game = games.find(g => g.id === data.gameId)
            if (!game) game = { id: data.gameId, name: data.gameName, isCustom: true, isUnknown: true }
            await prepareAndLaunch(game)
        }

        const onPlayingChanged = (data) => setLobbyPlaying(data.isPlaying)

        // Admin re-broadcasts current game state when membership changes.
        // This is the primary fix for late joiners and reconnecting players:
        // when someone new joins the hub group, the admin pushes the current
        // selected game and playing status so they don't have to rely solely
        // on tincAPI.getState returning correct data.
        const onMembersUpdated = () => {
            if (!isHost) return
            // Delay slightly to allow the new member's GamePanel to subscribe first
            setTimeout(() => {
                const game    = selectedGameRef.current
                const playing = lobbyPlayingRef.current
                if (game)    hub.invoke('SelectGame', lobbyId, game.id, game.name).catch(() => {})
                if (playing) hub.invoke('NotifyPlaying', lobbyId, true).catch(() => {})
            }, 600)
        }

        hub.on('GameSelected',       onSelected)
        hub.on('GameStart',          onStart)
        hub.on('LobbyPlayingChanged', onPlayingChanged)
        hub.on('MembersUpdated',     onMembersUpdated)
        return () => {
            hub.off('GameSelected',       onSelected)
            hub.off('GameStart',          onStart)
            hub.off('LobbyPlayingChanged', onPlayingChanged)
            hub.off('MembersUpdated',     onMembersUpdated)
        }
    }, [hub, isHost, myIp, games])

    useEffect(() => {
        return () => {
            if (statePollerRef.current) clearInterval(statePollerRef.current)
        }
    }, [])

    // Non-host: poll tincAPI.getState every 15s to stay in sync with lobby playing state.
    // This is the fallback "service check" — real-time events can be missed (hub reconnect,
    // transient network blip), so we periodically verify directly from the backend.
    useEffect(() => {
        if (isHost) return
        if (statePollerRef.current) clearInterval(statePollerRef.current)
        statePollerRef.current = setInterval(async () => {
            try {
                const res = await tincAPI.getState(lobbyId)
                setLobbyPlaying(res.data.isPlaying)
            } catch {}
        }, 15000)
        return () => {
            if (statePollerRef.current) { clearInterval(statePollerRef.current); statePollerRef.current = null }
        }
    }, [lobbyId, isHost])

    function loadIcon(game) {
        if (!game) return
        if (game.logoUrl) setSelectedIcon(game.logoUrl)
        else window.electron?.games.getIcon(game).then(setSelectedIcon).catch(() => setSelectedIcon(null))
    }

    async function handleSelect(game) {
        setSelected(game)
        loadIcon(game)
        if (isHost && hub) {
            try { await hub.invoke('SelectGame', lobbyId, game.id, game.name) } catch {}
            // Persist selection to backend so late joiners can read it from tincAPI.getState
            tincAPI.lockGame(lobbyId, game.id, game.name).catch(() => {})
        }
    }

    async function launchGame(game) {
        setPhase('launching')
        let installed = await window.electron.games.isInstalled(game)

        if (!installed) {
            const exe = await window.electron.games.pickExe()
            if (!exe) {
                toast(t('gamePanel.gameNotSelected', { name: game.name }), 'error', 5000)
                setPhase('idle')
                return false
            }
            if (game.isUnknown) {
                const saved = await window.electron.games.addCustom(game.name, exe)
                game = saved
            } else if (!game.isCustom) {
                await window.electron.games.setOverride(game.id, exe)
            }
            installed = true
        }

        const res = await window.electron.games.launch(game)
        if (res.success) {
            toast(t('gamePanel.launched', { name: game.name }), 'success')
            setPhase('playing')
            setLobbyPlaying(true)
            tincAPI.setPlaying(lobbyId, true).catch(() => {})
            hub?.invoke('NotifyPlaying', lobbyId, true).catch(() => {})
            watchedExeNameRef.current = res.exeName
            return true
        } else {
            toast(res.error || t('gamePanel.launchError'), 'error', 6000)
            setPhase('idle')
            return false
        }
    }

    async function prepareAndLaunch(game) {
        if (!myIp) { toast(t('gamePanel.netbirdNotConnected'), 'error'); return }
        setPhase('preparing')
        try {
            if (USES_TINC(game.gameType)) {
                const { version, tincIp } = await bringUpMesh(lobbyId, myIp, (s, msg) => setPrepMsg(msg))
                onMeshActive?.(version)
                setTincIp(tincIp)
            }
            await launchGame(game)
        } catch (e) {
            toast(e.message || t('gamePanel.prepareError'), 'error', 6000)
            setPhase('idle')
        }
    }

    async function handleStart() {
        if (!selectedGame) { toast(t('gamePanel.selectGameFirst'), 'error'); return }
        if (!myIp) { toast(t('gamePanel.netbirdNotConnected'), 'error'); return }

        setPhase('preparing')
        try {
            // Ensure game lock is persisted so late joiners can read it
            await tincAPI.lockGame(lobbyId, selectedGame.id, selectedGame.name).catch(() => {})
            if (USES_TINC(selectedGame.gameType)) {
                const { version, tincIp } = await bringUpMesh(lobbyId, myIp, (s, msg) => setPrepMsg(msg))
                onMeshActive?.(version)
                setTincIp(tincIp)
            }
            const ok = await launchGame(selectedGame)
            if (ok && hub) {
                await hub.invoke('StartGame', lobbyId, selectedGame.id, selectedGame.name)
            }
        } catch (e) {
            toast(e.message || t('gamePanel.prepareGameError'), 'error', 6000)
            setPhase('idle')
        }
    }

    async function handleJoinGame() {
        if (!selectedGame) return
        await prepareAndLaunch(selectedGame)
    }

    return (
        <div className="px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
                <span className="og-label text-og-muted">{t('gamePanel.label')}</span>
                {lobbyPlaying && (
                    <span className="flex items-center gap-1.5 text-gn-green text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-gn-green animate-pulse" />
                        {t('gamePanel.playing')}
                    </span>
                )}
            </div>

            {isHost ? (
                <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    disabled={phase === 'preparing' || phase === 'launching'}
                    className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg hover:bg-og-hover text-start transition-colors disabled:opacity-40 no-drag">
                    {selectedIcon
                        ? <img src={selectedIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                        : <Icon icon={Gamepad2} size="sm" className="text-og-muted" />}
                    <span className="text-xs flex-1 truncate text-og-body">
                        {selectedGame ? selectedGame.name : t('gamePanel.selectGame')}
                    </span>
                    <Icon icon={ChevronDown} size="xs" className="text-og-muted" />
                </button>
            ) : (
                // کاربر عادی هم می‌تونه مدال رو باز کنه تا بازی رو دانلود کنه یا فایل
                // اجرایی‌اش رو ست/اصلاح کنه — ولی انتخابِ بازیِ استارت فقط با میزبانه.
                <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    title={t('gamePanel.downloadOrPickExe')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg hover:bg-og-hover text-start transition-colors no-drag">
                    {selectedIcon
                        ? <img src={selectedIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                        : <Icon icon={Gamepad2} size="sm" className="text-og-muted" />}
                    <span className="text-xs flex-1 truncate text-og-body">
                        {selectedGame ? selectedGame.name : t('gamePanel.waitingForHostSelect')}
                    </span>
                    <Icon icon={Download} size="xs" className="text-og-muted" />
                </button>
            )}

            {phase === 'preparing' ? (
                <div className="flex items-center gap-2 py-2">
                    <div className="w-4 h-4 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin shrink-0" />
                    <span className="text-og-accent text-xs">{prepMsg}</span>
                </div>
            ) : phase === 'launching' ? (
                <div className="py-2 text-gn-green text-xs">{t('gamePanel.launching')}</div>
            ) : phase === 'playing' ? (
                <div className="flex items-center justify-center gap-2 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gn-green animate-pulse" />
                    <span className="text-gn-green text-xs">{t('gamePanel.playing')}</span>
                </div>
            ) : isHost ? (
                <button
                    type="button"
                    onClick={handleStart}
                    disabled={!selectedGame}
                    className="og-btn-primary w-full py-2.5 text-xs disabled:opacity-40">
                    {t('gamePanel.startGame')}
                </button>
            ) : lobbyPlaying ? (
                <button
                    type="button"
                    onClick={handleJoinGame}
                    disabled={!selectedGame}
                    className="og-btn-primary w-full py-2.5 text-xs disabled:opacity-40">
                    {t('gamePanel.joinGame')}
                </button>
            ) : (
                <div className="text-center text-og-muted text-xs py-2">{t('gamePanel.waitingHostStart')}</div>
            )}

            {isHost && selectedGame && streamEnabled && (
                <StreamButton exeName={selectedGame.exeName} />
            )}

            {showModal && (
                <GameSelectModal
                    games={games}
                    customGames={customGames}
                    selectedId={selectedGame?.id}
                    onSelect={handleSelect}
                    onClose={() => setShowModal(false)}
                    canSelect={isHost}
                />
            )}
        </div>
    )
}