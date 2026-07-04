import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Eye, EyeOff, Lock, Swords, X } from 'lucide-react'
import { netbirdAPI } from '../api'
import { useLobbyStore } from '../store/lobbyStore'
import { useSetupStore, PHASE } from '../store/setupStore'
import AppShell from '../components/AppShell'
import NetworkGateBanner from '../components/NetworkGateBanner'
import Icon from '../components/ui/Icon'

export default function LobbyListPage() {
    const { t } = useTranslation()
    const navigate                    = useNavigate()
    const [groups, setGroups]         = useState([])
    const [loadingGroups, setLoading] = useState(false)
    const [joiningId, setJoiningId]   = useState(null)
    const [error, setError]           = useState('')
    const [search, setSearch]         = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [pendingJoin, setPendingJoin] = useState(null) // group needing password
    const currentLobbyId = useLobbyStore(s => s.activeLobby?.groupId)
    const networkReady   = useSetupStore(s => s.phase === PHASE.DONE)

    useEffect(() => { fetchGroups() }, [])

    async function fetchGroups() {
        setLoading(true)
        setError('')
        try {
            const res = await netbirdAPI.getGroups()
            setGroups(Array.isArray(res.data) ? res.data : [])
        } catch (e) {
            setGroups([])
            setError(e.response?.data?.message || t('lobbyList.loadError'))
        } finally { setLoading(false) }
    }

    async function handleJoinAndEnter(groupId, password = '') {
        setJoiningId(groupId)
        setError('')
        try {
            await netbirdAPI.joinGroup(groupId, password)
            navigate(`/lobby/${groupId}`)
        } catch (e) {
            const msg = e.response?.data?.message || t('lobbyList.joinError')
            setError(msg)
            setJoiningId(null)
        }
    }

    function handleGroupJoin(group) {
        if (group.isPrivate) {
            setPendingJoin(group)
        } else {
            handleJoinAndEnter(group.id)
        }
    }

    async function handleJoinById(id) {
        const trimmed = id.trim()
        if (!trimmed) return
        // Try joining; if private the server returns 400 with requiresPassword
        setJoiningId(trimmed)
        setError('')
        try {
            await netbirdAPI.joinGroup(trimmed)
            navigate(`/lobby/${trimmed}`)
        } catch (e) {
            if (e.response?.data?.requiresPassword) {
                const group = groups.find(g => g.id === trimmed) || { id: trimmed, name: trimmed, isPrivate: true }
                setPendingJoin(group)
                setJoiningId(null)
            } else {
                setError(e.response?.data?.message || t('lobbyList.joinError'))
                setJoiningId(null)
            }
        }
    }

    const filtered = (groups || []).filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.id.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <AppShell>
            <div className="flex flex-col flex-1 min-h-0 min-w-0 og-panel overflow-hidden">
                <div className="px-5 pt-4">
                    <NetworkGateBanner />
                </div>
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-og flex-shrink-0">
                    <div>
                        <p className="og-label text-og-muted">{t('lobbyList.headerLabel')}</p>
                        <h2 className="og-title text-xl text-og-accent">{t('lobbyList.headerTitle')}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={fetchGroups} className="og-btn-ghost px-3 text-xs">
                            {t('lobbyList.refresh')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            disabled={!networkReady}
                            title={!networkReady ? t('lobbyList.connectingToNetwork') : ''}
                            className="og-btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                            {t('lobbyList.createLobby')}
                        </button>
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="px-5 py-4 border-b border-og">
                        <SearchBar
                            value={search}
                            onChange={setSearch}
                            onJoinById={handleJoinById}
                            joining={!!joiningId}
                            currentLobbyId={currentLobbyId}
                            networkReady={networkReady}
                        />
                    </div>

                    <div className="px-5 py-4">
                        {error && (
                            <div className="mb-4 rounded-lg og-error-box p-3 text-xs">
                                {error}
                            </div>
                        )}

                        {loadingGroups ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-og-muted text-sm">
                                <span className="w-5 h-5 border-2 border-og-primary/30 border-t-og-primary rounded-full animate-spin" />
                                {t('common.loading')}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-og-muted">
                                <Icon icon={Swords} size="lg" className="opacity-25" />
                                <p className="text-sm">
                                    {search ? t('lobbyList.noResults') : t('lobbyList.noLobbies')}
                                </p>
                            </div>
                        ) : (
                            <div>
                                {filtered.map(g => (
                                    <GroupRow
                                        key={g.id}
                                        group={g}
                                        joining={joiningId === g.id}
                                        isCurrentLobby={g.id === currentLobbyId}
                                        onJoin={() => handleGroupJoin(g)}
                                        networkReady={networkReady}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showCreate && (
                <CreateLobbyModal
                    onClose={() => setShowCreate(false)}
                    onCreate={(id) => navigate(`/lobby/${id}`, { state: { isHost: true } })}
                />
            )}

            {pendingJoin && (
                <PasswordPromptModal
                    group={pendingJoin}
                    joining={joiningId === pendingJoin.id}
                    onClose={() => setPendingJoin(null)}
                    onJoin={(password) => {
                        setPendingJoin(null)
                        handleJoinAndEnter(pendingJoin.id, password)
                    }}
                />
            )}
        </AppShell>
    )
}

function SearchBar({ value, onChange, onJoinById, joining, currentLobbyId, networkReady }) {
    const { t } = useTranslation()
    const [mode, setMode] = useState('search')
    const [idInput, setIdInput] = useState('')
    const isCurrentLobby = currentLobbyId && idInput.trim() === currentLobbyId

    return (
        <div>
            <div className="flex gap-1 p-1 rounded-lg bg-og-tab w-fit mb-3">
                {[['search', t('lobbyList.searchTab')], ['id', t('lobbyList.joinByIdTab')]].map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => { setMode(key); onChange('') }}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            mode === key ? 'og-tab-active' : 'og-tab-inactive hover:text-og-body'
                        }`}>
                        {label}
                    </button>
                ))}
            </div>

            {mode === 'search' ? (
                <input
                    className="og-input w-full max-w-xl"
                    placeholder={t('lobbyList.searchPlaceholder')}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                />
            ) : (
                <div className="flex gap-2 max-w-xl">
                    <input
                        className="og-input flex-1 font-mono text-sm"
                        placeholder={t('lobbyList.idPlaceholder')}
                        value={idInput}
                        onChange={e => setIdInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onJoinById(idInput)}
                    />
                    <button
                        type="button"
                        onClick={() => onJoinById(idInput)}
                        disabled={!idInput.trim() || joining || isCurrentLobby || !networkReady}
                        className="og-btn-primary px-4 py-2.5 text-xs shrink-0 disabled:opacity-50">
                        {joining ? '...' : isCurrentLobby ? t('lobbyList.inLobby') : !networkReady ? t('common.connecting') : t('common.join')}
                    </button>
                </div>
            )}
        </div>
    )
}

function GroupRow({ group, joining, isCurrentLobby, onJoin, networkReady }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    function copyId(e) {
        e.stopPropagation()
        navigator.clipboard.writeText(group.id)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex items-center gap-3 py-3.5 border-b border-og last:border-b-0 group">
            <div className="w-10 h-10 og-avatar-ring flex items-center justify-center text-og-accent shrink-0">
                <Icon icon={Swords} size="md" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-og-body text-sm font-semibold truncate">{group.name}</span>
                    {group.isPrivate && (
                        <Icon icon={Lock} size="xs" className="text-og-muted shrink-0" title={t('lobbyList.privateLobby')} />
                    )}
                </div>
                <button
                    type="button"
                    onClick={copyId}
                    className="flex items-center gap-1.5 mt-0.5 text-start group/copy"
                    title={t('lobbyList.clickToCopy')}>
                    <span className="font-mono text-og-muted text-xs group-hover/copy:text-og-accent transition-colors truncate max-w-[200px]">
                        {group.id}
                    </span>
                    <span className={`text-xs shrink-0 flex items-center gap-0.5 ${copied ? 'text-og-success' : 'text-og-muted group-hover/copy:text-og-accent'}`}>
                        {copied ? <Icon icon={Check} size="xs" /> : <Icon icon={Copy} size="xs" />}
                    </span>
                </button>
            </div>

            <div className="text-end shrink-0 px-2">
                <div className="text-og-body text-sm font-mono font-bold">{group.peersCount}</div>
                <div className="text-og-muted text-xs">{t('lobbyList.playersUnit')}</div>
            </div>

            <button
                type="button"
                onClick={onJoin}
                disabled={joining || isCurrentLobby || !networkReady}
                title={!networkReady ? t('lobbyList.connectingToNetwork') : ''}
                className="og-btn-primary px-4 py-2 text-xs shrink-0 disabled:opacity-50">
                {joining ? (
                    <span className="w-4 h-4 border-2 border-og-primary/30 border-t-og-badge rounded-full animate-spin inline-block" />
                ) : isCurrentLobby ? t('lobbyList.inLobby') : !networkReady ? t('common.connecting') : (
                    <span className="flex items-center gap-1">
                        {group.isPrivate && <Icon icon={Lock} size="xs" />}
                        {t('common.join')}
                    </span>
                )}
            </button>
        </div>
    )
}

function PasswordPromptModal({ group, joining, onClose, onJoin }) {
    const { t } = useTranslation()
    const [password, setPassword] = useState('')
    const [showPw, setShowPw]     = useState(false)
    const [error, setError]       = useState('')
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    function handleJoin() {
        if (!password.trim()) { setError(t('lobbyList.passwordRequired')); return }
        setError('')
        onJoin(password)
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-drag">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <div
                className="relative w-full max-w-sm og-panel p-6 shadow-2xl no-drag"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <Icon icon={Lock} size="sm" className="text-og-accent" />
                            <h3 className="og-title text-lg text-og-accent">{t('lobbyList.passwordPromptTitle')}</h3>
                        </div>
                        <p className="text-og-muted text-xs mt-0.5 truncate max-w-[220px]">{group.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-og-hover text-og-muted hover:text-og-body transition-colors">
                        <Icon icon={X} size="sm" />
                    </button>
                </div>

                <div className="mb-4">
                    <label className="og-label text-og-muted block mb-2">{t('lobbyList.passwordLabel')}</label>
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type={showPw ? 'text' : 'password'}
                            className="og-input no-drag w-full pe-10"
                            placeholder={t('lobbyList.passwordPlaceholder')}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoin()}
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw(v => !v)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-og-muted hover:text-og-body transition-colors">
                            <Icon icon={showPw ? EyeOff : Eye} size="xs" />
                        </button>
                    </div>
                    {error && <p className="text-xs text-og-error mt-1">{error}</p>}
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="og-btn-ghost flex-1">
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleJoin}
                        disabled={joining || !password.trim()}
                        className="og-btn-primary flex-1">
                        {joining ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-3 h-3 border border-og-primary border-t-og-badge rounded-full animate-spin" />
                                {t('lobbyList.enteringLobby')}
                            </span>
                        ) : t('lobbyList.enter')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

function CreateLobbyModal({ onClose, onCreate }) {
    const { t } = useTranslation()
    const [name, setName]           = useState('')
    const [isPrivate, setIsPrivate] = useState(false)
    const [password, setPassword]   = useState('')
    const [showPw, setShowPw]       = useState(false)
    const [creating, setCreating]   = useState(false)
    const [error, setError]         = useState('')
    const nameRef = useRef(null)

    useEffect(() => { nameRef.current?.focus() }, [])

    async function handleCreate() {
        if (!name.trim()) return
        if (isPrivate && !password.trim()) { setError(t('lobbyList.createPasswordRequired')); return }
        setCreating(true)
        setError('')
        try {
            const res = await netbirdAPI.createGroup(name.trim(), isPrivate, password)
            onCreate(res.data.id)
        } catch (e) {
            setError(e.response?.data?.message || t('lobbyList.createError'))
            setCreating(false)
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-drag">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />

            <div
                className="relative w-full max-w-sm og-panel p-6 shadow-2xl no-drag"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-lobby-title">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 id="create-lobby-title" className="og-title text-lg text-og-accent">
                            {t('lobbyList.createModalTitle')}
                        </h3>
                        <p className="text-og-muted text-xs mt-0.5">{t('lobbyList.createModalSubtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-og-hover text-og-muted hover:text-og-body transition-colors">
                        <Icon icon={X} size="sm" />
                    </button>
                </div>

                <div className="mb-4">
                    <label htmlFor="lobby-name" className="og-label text-og-muted block mb-2">
                        {t('lobbyList.nameLabel')}
                    </label>
                    <input
                        id="lobby-name"
                        ref={nameRef}
                        type="text"
                        className="og-input no-drag w-full"
                        placeholder={t('lobbyList.namePlaceholder')}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !isPrivate && handleCreate()}
                        maxLength={32}
                        autoComplete="off"
                    />
                    <div className="text-end text-og-muted text-xs mt-1">{name.length}/32</div>
                </div>

                {/* Private lobby toggle */}
                <div className="mb-4">
                    <button
                        type="button"
                        onClick={() => { setIsPrivate(v => !v); setPassword('') }}
                        className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border transition-colors ${
                            isPrivate
                                ? 'border-og-primary bg-og-primary/10 text-og-accent'
                                : 'border-og hover:border-og-primary/50 text-og-muted hover:text-og-body'
                        }`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isPrivate ? 'bg-og-primary border-og-primary' : 'border-og-muted'
                        }`}>
                            {isPrivate && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>
                        <Icon icon={Lock} size="xs" className="shrink-0" />
                        <span className="text-xs font-medium">{t('lobbyList.privateToggle')}</span>
                    </button>
                </div>

                {isPrivate && (
                    <div className="mb-4">
                        <label className="og-label text-og-muted block mb-2">{t('lobbyList.createPasswordLabel')}</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="og-input no-drag w-full pe-10"
                                placeholder={t('lobbyList.createPasswordPlaceholder')}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(v => !v)}
                                className="absolute end-3 top-1/2 -translate-y-1/2 text-og-muted hover:text-og-body transition-colors">
                                <Icon icon={showPw ? EyeOff : Eye} size="xs" />
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 rounded-lg og-error-box text-xs">
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="og-btn-ghost flex-1">
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating || !name.trim() || (isPrivate && !password.trim())}
                        className="og-btn-primary flex-1">
                        {creating ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-3 h-3 border border-og-primary border-t-og-badge rounded-full animate-spin" />
                                {t('lobbyList.creating')}
                            </span>
                        ) : t('lobbyList.createSubmit')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
