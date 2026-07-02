import { useEffect } from 'react'
import { useUpdateStore } from '../store/updateStore'

export default function UpdateNotifier() {
    const { setProgress, setReady } = useUpdateStore()

    useEffect(() => {
        if (!window.electron?.update) return
        window.electron.update.onProgress(p  => setProgress(p))
        window.electron.update.onDownloaded(() => setReady())
    }, [])

    return null
}
