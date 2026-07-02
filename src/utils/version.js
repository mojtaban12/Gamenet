export function isOlderVersion(current, latest) {
    const curParts = String(current).split('.')
    const latParts = String(latest).split('.')

    if (curParts.length !== latParts.length) {
        const curBuild = Number(curParts[curParts.length - 1]) || 0
        const latBuild = Number(latParts[latParts.length - 1]) || 0
        return curBuild < latBuild
    }

    for (let i = 0; i < Math.max(curParts.length, 3); i++) {
        const c = Number(curParts[i]) || 0
        const l = Number(latParts[i]) || 0
        if (c < l) return true
        if (c > l) return false
    }
    return false
}
