import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { leaveLobby } from '../store/lobbyStore'

export default function LobbySession() {
    const token = useAuthStore(s => s.token)

    useEffect(() => {
        if (!token) leaveLobby()
    }, [token])

    return null
}
