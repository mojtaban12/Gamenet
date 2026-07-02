import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useSettingStore } from '../store/settingStore'

export default function SettingsLoader() {
    const token = useAuthStore(s => s.token)
    const load  = useSettingStore(s => s.load)

    useEffect(() => {
        if (token) load()
    }, [token])

    return null
}
