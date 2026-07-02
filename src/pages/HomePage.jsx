import { useNavigate } from 'react-router-dom'
import { AlertTriangle, MessageCircle, Mic2, Play, Swords, Users } from 'lucide-react'
import { usePresenceStore } from '../store/presenceStore'
import AppShell from '../components/AppShell'
import Icon from '../components/ui/Icon'

const FEATURES = [
    { title: 'لابی', desc: 'ساخت و جوین', icon: Swords },
    { title: 'چت', desc: 'پیام با دوستان', icon: MessageCircle },
    { title: 'ویس', desc: 'مثل Steam', icon: Mic2 },
]

const SOCIAL_LINKS = [
    {
        label: 'اینستاگرام',
        handle: '@tarcommunity',
        href: 'https://www.instagram.com/tarcommunity/',
        icon: InstagramIcon,
    },
    {
        label: 'تلگرام',
        handle: '@tarcommunity',
        href: 'https://t.me/tarcommunity',
        icon: TelegramIcon,
    },
]

export default function HomePage() {
    const navigate = useNavigate()
    const { friends } = usePresenceStore()

    const onlineFriends = friends.filter(f => f.online)
    const displayFriends = onlineFriends.length > 0 ? onlineFriends.slice(0, 4) : friends.slice(0, 4)

    return (
        <AppShell>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto pb-8 pr-1">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-8 space-y-5">
                            <AboutCard onStart={() => navigate('/rooms')} onFriends={() => navigate('/friends')} />
                            <BetaNotice />
                            <FeedbackCard />
                        </div>

                        <div className="xl:col-span-4">
                            <OnlineFriendsCard
                                onlineCount={onlineFriends.length}
                                friends={displayFriends}
                                onOpenFriends={() => navigate('/friends')}
                                onOpenChat={friendId => navigate('/friends', { state: { openChatWith: friendId } })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    )
}

function AboutCard({ onStart, onFriends }) {
    return (
        <section className="og-home-about relative overflow-hidden rounded-2xl p-6 md:p-8">
            <div className="absolute inset-0 og-home-about-bg" />
            <div className="absolute inset-0 og-home-about-overlay" />

            <div className="relative space-y-6 text-right">
                <div className="space-y-4">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-og-primary-dim border border-og-primary text-og-accent og-label">
                        <Icon icon={Play} size="xs" />
                        تارگیم چیه؟
                    </span>
                    <h1 className="og-title text-3xl md:text-4xl font-black text-og-body leading-tight tracking-tight">
                        گیم‌نت شخصی برای{' '}
                        <span className="text-og-accent">بازی با دوستان</span>
                    </h1>
                    <p className="text-og-muted text-sm md:text-base max-w-2xl leading-relaxed">
                        تارگیم یک کلاینت سبکه برای LAN کردن با اسکواد. لابی، چت و ویس — چیزایی که گیمرها
                        معمولاً تو Steam می‌شناسن — اینجا یکجا جمع شدن.
                    </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                    {FEATURES.map(feature => (
                        <div
                            key={feature.title}
                            className="og-home-feature rounded-xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-og-primary-dim border border-og-primary flex items-center justify-center shrink-0">
                                <Icon icon={feature.icon} size="md" className="text-og-accent" />
                            </div>
                            <div className="min-w-0">
                                <p className="og-title text-sm text-og-body">{feature.title}</p>
                                <p className="text-og-muted text-xs mt-0.5">{feature.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={onStart} className="og-btn-primary px-8 py-3 og-neon-glow">
                        ساخت یا جوین لابی
                    </button>
                    <button type="button" onClick={onFriends} className="og-btn-ghost px-6 py-3">
                        دیدن دوستان
                    </button>
                </div>
            </div>
        </section>
    )
}

function BetaNotice() {
    return (
        <section className="og-card rounded-2xl p-5 flex gap-4 text-right">
            <div className="w-11 h-11 rounded-xl bg-[#fec931]/10 border border-[#fec931]/30 flex items-center justify-center shrink-0">
                <Icon icon={AlertTriangle} size="md" className="text-[#fec931]" />
            </div>
            <div className="space-y-1 min-w-0">
                <p className="og-title text-base text-og-body">نسخه بتاست</p>
                <p className="text-og-muted text-sm leading-relaxed">
                    ممکنه باگ‌هایی در بخش‌های مختلف داشته باشیم، بخصوص در LAN کردن. اگر چیزی دیدید،
                    حتماً بهمون بگید.
                </p>
            </div>
        </section>
    )
}

function FeedbackCard() {
    return (
        <section className="og-card rounded-2xl p-5 space-y-4 text-right">
            <div>
                <p className="og-label text-og-accent">بازخورد</p>
                <h2 className="og-title text-lg text-og-body mt-1">نظراتتون برامون مهمه</h2>
                <p className="text-og-muted text-sm mt-2 leading-relaxed">
                    خوشحال می‌شیم بازخورد، پیشنهاد یا گزارش باگ‌تون رو تو اینستا یا تلگرام برامون بفرستید.
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                {SOCIAL_LINKS.map(link => (
                    <SocialLink key={link.label} {...link} />
                ))}
            </div>
        </section>
    )
}

function SocialLink({ href, label, handle, icon: SocialIcon }) {
    function openLink() {
        if (window.electron?.openExternal) {
            window.electron.openExternal(href)
            return
        }
        window.open(href, '_blank', 'noopener,noreferrer')
    }

    return (
        <button
            type="button"
            onClick={openLink}
            className="inline-flex items-center gap-3 rounded-xl border border-og bg-og-tab px-4 py-3 transition-all hover:border-og-primary hover:bg-og-card">
            <span className="w-10 h-10 rounded-xl bg-og-primary-dim border border-og-primary flex items-center justify-center text-og-accent">
                <SocialIcon />
            </span>
            <span className="text-right">
                <span className="block og-title text-sm text-og-body">{label}</span>
                <span className="block text-og-muted text-xs mt-0.5 ltr" dir="ltr">{handle}</span>
            </span>
        </button>
    )
}

function OnlineFriendsCard({ onlineCount, friends, onOpenFriends, onOpenChat }) {
    return (
        <section className="og-card rounded-2xl p-5 space-y-4 xl:sticky xl:top-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="relative flex w-2.5 h-2.5">
                        {onlineCount > 0 && (
                            <span className="absolute inline-flex w-full h-full rounded-full bg-gn-green opacity-60 animate-ping" />
                        )}
                        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${onlineCount > 0 ? 'bg-gn-green' : 'bg-gn-muted'}`} />
                    </span>
                    <h2 className="og-title text-lg text-og-body">دوستان آنلاین</h2>
                </div>
                <span className="bg-og-primary-dim text-og-accent px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                    {onlineCount} نفر
                </span>
            </div>

            <div className="space-y-1">
                {friends.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <Icon icon={Users} size="lg" className="text-og-muted opacity-30" />
                        <p className="text-og-muted text-sm">هنوز دوستی آنلاین نیست</p>
                    </div>
                ) : (
                    friends.map(friend => (
                        <button
                            key={friend.friendId}
                            type="button"
                            onClick={() => onOpenChat(friend.friendId)}
                            className="w-full flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-og-hover group text-right">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative flex-shrink-0">
                                    <div className={`w-10 h-10 og-avatar-ring text-sm font-bold ${friend.online ? 'ring-2 ring-og-primary/30' : ''}`}>
                                        {friend.username[0].toUpperCase()}
                                    </div>
                                    <span className={`absolute bottom-0 left-0 w-3 h-3 rounded-full border-2 border-gn-bg ${friend.online ? 'bg-gn-green' : 'bg-gn-muted'}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="og-title text-sm text-og-body truncate">{friend.username}</p>
                                    <p className={`text-xs truncate ${friend.online ? 'text-og-accent' : 'text-og-muted'}`}>
                                        {friend.online ? 'آنلاین' : 'آفلاین'}
                                    </p>
                                </div>
                            </div>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-og-primary-dim">
                                <Icon icon={MessageCircle} size="sm" className="text-og-accent" />
                            </span>
                        </button>
                    ))
                )}
            </div>

            <button
                type="button"
                onClick={onOpenFriends}
                className="w-full py-2.5 bg-og-tab border border-og rounded-xl text-sm text-og-muted transition-all hover:text-og-body hover:border-og-primary">
                مشاهده همه دوستان
            </button>
        </section>
    )
}

function InstagramIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    )
}

function TelegramIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    )
}
