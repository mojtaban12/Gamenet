import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, CirclePlus, Download, Gamepad2, Pencil, Search, Trash2, X } from 'lucide-react'
import { applyGameMetaCache, storeGameMeta, isGameMetaCached } from '../utils/gameMetaCache'
import Icon from './ui/Icon'

// نرمال‌سازی اسم برای مقایسه تقریبی (حروف کوچک + حذف فاصله/علائم اضافه)
function normalizeName(s) {
    return (s || '')
        .toLowerCase()
        .replace(/[\s\-_:.]+/g, '')
        .trim()
}

/**
 * مودال انتخاب بازی — تمام‌صفحه (portal به body)
 */
export default function GameSelectModal({ games, customGames: customProp, selectedId, onSelect, onClose, canSelect = true }) {
    const [icons, setIcons]         = useState({})
    const [installed, setInstalled] = useState({})
    const [customGames, setCustom]  = useState(customProp || [])
    const [adding, setAdding]       = useState(false)
    const [newName, setNewName]     = useState('')
    const [newExe, setNewExe]       = useState('')
    const [nameError, setNameError] = useState('')
    const [search, setSearch]       = useState('')


    const allGames = [...games, ...customGames]

    // فیلتر سرچ (تقریبی)
    const q = normalizeName(search)
    const filteredGames = q
        ? allGames.filter(g => normalizeName(g.name).includes(q))
        : allGames

    useEffect(() => {
        if (customProp) {
            setCustom(customProp)
            return
        }
        window.electron?.games.getCustom().then(setCustom).catch(() => {})
    }, [customProp])

    useEffect(() => {
        let cancelled = false
        const list = allGames
        if (!list.length) {
            setIcons({})
            setInstalled({})
            return
        }

        const cached = applyGameMetaCache(list)
        setIcons(cached.icons)
        setInstalled(cached.installed)

        const uncached = list.filter(g => !isGameMetaCached(g.id))
        const batch = window.electron?.games?.getMetaBatch
        if (!uncached.length) return () => { cancelled = true }

        if (!batch) {
            uncached.forEach(g => storeGameMeta(g, { icon: g.logoUrl || null, installed: !!g.isCustom }))
            if (!cancelled) {
                const merged = applyGameMetaCache(list)
                setIcons(merged.icons)
                setInstalled(merged.installed)
            }
            return () => { cancelled = true }
        }

        batch(uncached).then(metas => {
            if (cancelled) return
            uncached.forEach((g, i) => storeGameMeta(g, metas[i]))
            const merged = applyGameMetaCache(list)
            setIcons(merged.icons)
            setInstalled(merged.installed)
        }).catch(() => {})

        return () => { cancelled = true }
    }, [games, customGames])

    function handleClick(g) {
        // فقط ادمین می‌تونه بازیِ استارتِ لابی رو انتخاب کنه. کاربر عادی با کلیک
        // روی بازی، فقط فایل اجرایی خودش رو ست/اصلاح می‌کنه (برای آماده‌سازی قبل
        // از استارتِ میزبان) — انتخاب بازیِ لابی تغییر نمی‌کنه.
        if (!canSelect) { setExe(g); return }
        // هر بازی قابل انتخابه؛ اگه نصب نباشه، موقع استارت فایل اجرایی پرسیده می‌شه
        onSelect(g)
        onClose()
    }

    async function pickExe() {
        const p = await window.electron.games.pickExe()
        if (p) setNewExe(p)
    }

    async function saveCustom() {
        if (!newName.trim() || !newExe) return

        // چک تکراری تقریبی با لیست سرور
        const dup = games.find(g => normalizeName(g.name) === normalizeName(newName))
        if (dup) {
            // این بازی توی لیست هست → custom نساز، فقط override رو با exe انتخابی ذخیره کن
            await window.electron.games.setOverride(dup.id, newExe)
            storeGameMeta(dup, { icon: dup.logoUrl || null, installed: true })
            setInstalled(prev => ({ ...prev, [dup.id]: true }))
            if (canSelect) {
                // ادمین: همون بازیِ لیست رو به‌عنوان بازیِ لابی انتخاب کن
                onSelect(dup)
                onClose()
            } else {
                // کاربر عادی: فقط فایل اجرایی ذخیره شد — برگرد به لیست
                setAdding(false); setNewName(''); setNewExe(''); setNameError('')
            }
            return
        }

        const game = await window.electron.games.addCustom(newName.trim(), newExe)
        storeGameMeta(game, { icon: null, installed: true })
        setCustom(prev => [...prev, game])
        setAdding(false)
        setNewName('')
        setNewExe('')
        setNameError('')
    }

    async function removeCustom(e, g) {
        e.stopPropagation()
        await window.electron.games.removeCustom(g.id)
        setCustom(prev => prev.filter(x => x.id !== g.id))
    }

    function handleDownload(e, g) {
        e.stopPropagation()
        window.electron?.openExternal(g.downloadUrl)
    }

    // ست/ویرایش فایل exe بازی (custom یا override بازی سروری)
    async function setExe(g) {
        const exe = await window.electron.games.pickExe()
        if (!exe) return
        if (g.isCustom) {
            const updated = await window.electron.games.updateCustom(g.id, exe)
            if (updated) setCustom(prev => prev.map(x => x.id === g.id ? { ...x, exePath: exe } : x))
        } else {
            await window.electron.games.setOverride(g.id, exe)
            storeGameMeta(g, { icon: g.logoUrl || null, installed: true })
            setInstalled(prev => ({ ...prev, [g.id]: true }))
        }
    }

    async function editExe(e, g) {
        e.stopPropagation()
        await setExe(g)
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col no-drag">
            <div
                className="absolute inset-0 bg-black/75"
                onClick={onClose}
                aria-hidden
            />

            <div
                className="relative flex flex-col flex-1 min-h-0 m-0 og-panel shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="game-select-title">

                <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-og flex-shrink-0">
                    <div>
                        <h3 id="game-select-title" className="og-title text-lg text-og-accent">
                            {canSelect ? 'انتخاب بازی' : 'مدیریت بازی‌ها'}
                        </h3>
                        <p className="text-og-muted text-xs mt-0.5">
                            {canSelect
                                ? 'بازی نصب‌شده را انتخاب یا بازی جدید اضافه کنید'
                                : 'بازی را دانلود کنید یا فایل اجرایی آن را انتخاب کنید'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-og-hover text-og-muted hover:text-og-body transition-colors">
                        <Icon icon={X} size="sm" />
                    </button>
                </header>

                {!adding && (
                    <div className="px-6 pt-4 flex-shrink-0">
                        <div className="relative max-w-md">
                            <input
                                className="og-input w-full py-2.5 pr-9"
                                placeholder="جستجوی بازی..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Icon icon={Search} size={15} className="absolute top-1/2 right-3 -translate-y-1/2 text-og-muted pointer-events-none" />
                        </div>
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
                    {adding ? (
                        <div className="max-w-md mx-auto space-y-4">
                            <div>
                                <label className="og-label text-og-muted block mb-1.5">نام بازی</label>
                                <input
                                    className="og-input w-full py-2.5"
                                    placeholder="مثلاً Age of Empires"
                                    value={newName}
                                    onChange={e => { setNewName(e.target.value); setNameError('') }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="og-label text-og-muted block mb-1.5">فایل اجرایی (exe)</label>
                                <div className="flex gap-2">
                                    <input
                                        className="og-input flex-1 py-2.5 text-xs"
                                        placeholder="مسیری انتخاب نشده"
                                        value={newExe}
                                        readOnly
                                    />
                                    <button
                                        type="button"
                                        onClick={pickExe}
                                        className="og-btn-ghost px-4 py-2.5 text-xs shrink-0">
                                        انتخاب فایل
                                    </button>
                                </div>
                            </div>
                            {nameError && (
                                <p className="text-og-accent text-xs">{nameError}</p>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={saveCustom}
                                    disabled={!newName.trim() || !newExe}
                                    className="og-btn-primary flex-1 py-2.5 text-xs disabled:opacity-40">
                                    افزودن
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAdding(false); setNewName(''); setNewExe(''); setNameError('') }}
                                    className="og-btn-ghost px-4 py-2.5 text-xs">
                                    انصراف
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-6xl mx-auto">
                            {filteredGames.map(g => {
                                const isSelected = selectedId === g.id
                                const isInst = installed[g.id]
                                const icon = icons[g.id]

                                return (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => handleClick(g)}
                                        className={`group relative aspect-square rounded-xl overflow-hidden transition-all duration-200 ${
                                            isSelected
                                                ? 'ring-2 ring-og-primary scale-[1.02]'
                                                : 'hover:ring-1 hover:ring-og-primary/50 hover:scale-[1.02]'
                                        }`}>

                                        <div className="absolute inset-0 flex items-center justify-center bg-og-subtle">
                                            {icon
                                                ? <img src={icon} alt={g.name} className="w-16 h-16 object-contain" loading="lazy" />
                                                : <Icon icon={Gamepad2} size={48} className="opacity-20" />}
                                        </div>

                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                                            <div className="text-og-body text-xs font-semibold text-center truncate">
                                                {g.name}
                                            </div>
                                            <div className="flex items-center justify-center gap-1 mt-1">
                                                {g.isCustom ? (
                                                    <span className="text-og-accent text-[10px]">شخصی</span>
                                                ) : isInst === undefined ? (
                                                    <span className="text-og-muted text-[10px]">بررسی...</span>
                                                ) : isInst ? (
                                                    <>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-gn-green" />
                                                        <span className="text-gn-green text-[10px]">نصب شده</span>
                                                    </>
                                                ) : (
                                                    <span className="text-og-muted text-[10px]">انتخاب فایل</span>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-6 h-6 bg-og-primary rounded-full flex items-center justify-center">
                                                <Icon icon={Check} size="xs" className="text-[var(--og-badge-text)]" strokeWidth={3} />
                                            </div>
                                        )}

                                        {/* دکمه دانلود — همیشه نمایان اگه downloadUrl داشته باشه */}
                                        {g.downloadUrl && (
                                            <div
                                                onClick={(e) => handleDownload(e, g)}
                                                title="دانلود بازی"
                                                className="absolute top-2 left-2 w-6 h-6 bg-black/60 hover:bg-og-primary/80 rounded-full flex items-center justify-center text-white cursor-pointer z-10">
                                                <Icon icon={Download} size={11} />
                                            </div>
                                        )}

                                        {/* دکمه‌های ویرایش/حذف (hover) */}
                                        <div className={`absolute top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${g.downloadUrl ? 'left-9' : 'left-2'}`}>
                                            {/* ویرایش exe — custom یا بازی سروری نصب‌شده */}
                                            {(g.isCustom || isInst) && (
                                                <div
                                                    onClick={(e) => editExe(e, g)}
                                                    title="تغییر فایل اجرایی"
                                                    className="w-6 h-6 bg-black/60 hover:bg-og-primary/80 rounded-full flex items-center justify-center text-white cursor-pointer">
                                                    <Icon icon={Pencil} size={11} />
                                                </div>
                                            )}
                                            {/* حذف — فقط custom */}
                                            {g.isCustom && (
                                                <div
                                                    onClick={(e) => removeCustom(e, g)}
                                                    title="حذف بازی"
                                                    className="w-6 h-6 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center text-white cursor-pointer">
                                                    <Icon icon={Trash2} size={11} />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}

                            {!search && (
                                <button
                                    type="button"
                                    onClick={() => setAdding(true)}
                                    className="aspect-square rounded-xl border-2 border-dashed border-og flex flex-col items-center justify-center gap-2 text-og-muted hover:text-og-accent hover:border-og-primary transition-colors">
                                    <Icon icon={CirclePlus} size="lg" />
                                    <span className="og-label text-[10px]">افزودن بازی</span>
                                </button>
                            )}

                            {search && filteredGames.length === 0 && (
                                <div className="col-span-full text-center text-og-muted text-sm py-12">
                                    بازی‌ای یافت نشد
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}