const metaCache = new Map()

export function applyGameMetaCache(list) {
    const icons = {}
    const installed = {}
    for (const g of list) {
        const c = metaCache.get(g.id)
        if (c) {
            icons[g.id] = c.icon
            installed[g.id] = c.installed
        }
    }
    return { icons, installed }
}

export function isGameMetaCached(id) {
    return metaCache.has(id)
}

export function storeGameMeta(game, meta) {
    metaCache.set(game.id, {
        icon: meta?.icon ?? game.logoUrl ?? null,
        installed: meta?.installed ?? !!game.isCustom,
    })
}

/** پیش‌بارگذاری وضعیت نصب/آیکون — قبل از باز شدن مودال */
export function prefetchGameMeta(games) {
    const list = games || []
    const uncached = list.filter(g => !metaCache.has(g.id))
    const batch = window.electron?.games?.getMetaBatch
    if (!uncached.length || !batch) return Promise.resolve()

    return batch(uncached).then(metas => {
        uncached.forEach((g, i) => storeGameMeta(g, metas[i]))
    }).catch(() => {})
}
