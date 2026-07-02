import { useState } from 'react'
import { LogIn, LogOut, Plus, X } from 'lucide-react'
import { useVoiceStore } from '../store/voiceStore'
import { useAuthStore } from '../store/authStore'
import { teamAPI } from '../api'
import Icon from './ui/Icon'

export default function TeamChannels({ groupId, isHost }) {
    const { channels, memberships, myChannelId } = useVoiceStore()
    const { user } = useAuthStore()
    const myUserId = user?.id?.toString()

    const [creating, setCreating] = useState(false)
    const [newName,  setNewName]  = useState('')
    const [loading,  setLoading]  = useState(null)

    if (!channels.length) return null

    const customCount = channels.filter(c => c.id !== 'lobby').length

    async function handleCreate() {
        const name = newName.trim()
        if (!name) return
        setLoading('create')
        try {
            await teamAPI.createTeam(groupId, name)
            setNewName('')
            setCreating(false)
        } catch {} finally {
            setLoading(null)
        }
    }

    async function handleDelete(channelId) {
        setLoading(channelId)
        try { await teamAPI.deleteTeam(groupId, channelId) } catch {}
        setLoading(null)
    }

    async function handleJoin(channelId) {
        setLoading(channelId)
        try { await teamAPI.joinChannel(groupId, channelId) } catch {}
        setLoading(null)
    }

    async function handleLeave() {
        setLoading('leave')
        try { await teamAPI.leaveChannel(groupId) } catch {}
        setLoading(null)
    }

    return (
        <div className="px-3 py-2 border-t border-og/50 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
                <span className="og-label text-og-muted text-[11px]">کانال‌های صوتی</span>
                {isHost && customCount < 2 && (
                    <button
                        type="button"
                        onClick={() => setCreating(s => !s)}
                        title="افزودن تیم"
                        className="text-og-muted hover:text-og-accent transition-colors no-drag">
                        <Icon icon={Plus} size={12} />
                    </button>
                )}
            </div>

            {creating && (
                <div className="flex gap-1 mb-2">
                    <input
                        autoFocus
                        className="og-input flex-1 text-xs py-1 px-2 no-drag"
                        placeholder="نام تیم..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleCreate()
                            if (e.key === 'Escape') { setCreating(false); setNewName('') }
                        }}
                        maxLength={20}
                    />
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={loading === 'create' || !newName.trim()}
                        className="og-btn-primary text-xs px-2 py-1 disabled:opacity-40 no-drag">
                        ایجاد
                    </button>
                    <button
                        type="button"
                        onClick={() => { setCreating(false); setNewName('') }}
                        className="text-og-muted hover:text-og-body transition-colors no-drag">
                        <Icon icon={X} size={13} />
                    </button>
                </div>
            )}

            <div className="space-y-1">
                {channels.map(ch => {
                    const isMe      = myChannelId === ch.id
                    const memberIds = Object.entries(memberships)
                        .filter(([, cid]) => cid === ch.id)
                        .map(([uid]) => uid)
                    const isLobby   = ch.id === 'lobby'

                    return (
                        <div
                            key={ch.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                                isMe
                                    ? 'bg-og-primary-dim border border-og-primary/25'
                                    : 'bg-og-subtle border border-transparent'
                            }`}>
                            {/* channel indicator dot */}
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 flex-none ${
                                isMe ? 'bg-og-accent' : 'bg-og-muted opacity-50'
                            }`} />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-xs font-medium text-og-body truncate">{ch.name}</span>
                                    {isMe && (
                                        <span className="text-[9px] text-og-accent shrink-0">شما اینجایید</span>
                                    )}
                                </div>
                                {memberIds.length > 0 && (
                                    <div className="text-[10px] text-og-muted mt-0.5">
                                        {memberIds.length} نفر
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                                {/* join another channel */}
                                {!isMe && (
                                    <button
                                        type="button"
                                        onClick={() => handleJoin(ch.id)}
                                        disabled={loading === ch.id}
                                        title="ورود به کانال"
                                        className="flex items-center justify-center w-6 h-6 rounded text-og-muted hover:text-og-accent hover:bg-og-hover transition-colors disabled:opacity-40 no-drag">
                                        <Icon icon={LogIn} size={12} />
                                    </button>
                                )}
                                {/* leave custom channel → back to lobby */}
                                {isMe && !isLobby && (
                                    <button
                                        type="button"
                                        onClick={handleLeave}
                                        disabled={loading === 'leave'}
                                        title="بازگشت به لابی"
                                        className="flex items-center justify-center w-6 h-6 rounded text-og-muted hover:text-og-body hover:bg-og-hover transition-colors disabled:opacity-40 no-drag">
                                        <Icon icon={LogOut} size={12} />
                                    </button>
                                )}
                                {/* admin delete */}
                                {isHost && !isLobby && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(ch.id)}
                                        disabled={loading === ch.id}
                                        title="حذف تیم"
                                        className="flex items-center justify-center w-6 h-6 rounded text-og-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 no-drag">
                                        <Icon icon={X} size={11} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
