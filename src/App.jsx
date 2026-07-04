import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useLocaleStore } from './store/localeStore'
import { useUiStore } from './store/uiStore'
import { useSettingStore } from './store/settingStore'
import { initAudio } from './utils/sound'
import { versionAPI } from './api'
import { isOlderVersion } from './utils/version'
import TitleBar from './components/TitleBar'
import PresenceProvider from './components/PresenceProvider'
import LobbySession from './components/LobbySession'
import SetupRunner from './components/SetupRunner'
import UpdateNotifier from './components/UpdateNotifier'
import SettingsLoader from './components/SettingsLoader'
import Notifications from './components/Notifications'
import ExitModal from './components/ExitModal'
import LogoutModal from './components/LogoutModal'
import UpdateBlockScreen from './components/UpdateBlockScreen'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import LobbyListPage from './pages/LobbyListPage'
import LobbyPage from './pages/LobbyPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

const APP_VERSION = window.electron?.appVersion || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0')


function MaintenanceScreen() {
    const { t } = useTranslation()
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-og-subtle flex items-center justify-center mb-2 text-4xl">
                🛠
            </div>
            <h2 className="og-title text-xl text-og-body">{t('app.maintenanceTitle')}</h2>
            <p className="text-og-muted text-sm max-w-xs leading-relaxed">
                {t('app.maintenanceBody')}
            </p>
        </div>
    )
}

function ProtectedRoute({ children }) {
    const { token, isLoading, user } = useAuthStore()
    const adminSettings  = useSettingStore(s => s.adminSettings)
    const settingsLoaded = useSettingStore(s => s.loaded)

    if (isLoading) return <LoadingScreen />
    if (!token) return <Navigate to="/auth" replace />

    const appDisabled = settingsLoaded
        && adminSettings['app.enabled'] === 'false'
        && user?.role !== 'Admin'

    return (
        <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden">
            {appDisabled ? <MaintenanceScreen /> : children}
        </div>
    )
}

function RootRedirect() {
    const token = useAuthStore(s => s.token)
    return <Navigate to={token ? '/home' : '/auth'} replace />
}

function LoadingScreen() {
    const { t } = useTranslation()
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <div className="w-8 h-8 border-2 border-gn-accent/30 border-t-gn-accent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gn-muted text-xs">{t('common.loading')}</p>
            </div>
        </div>
    )
}

export default function App() {
    const [quitting, setQuitting]         = useState(false)
    const [loggingOut, setLoggingOut]     = useState(false)
    const [versionReady, setVersionReady] = useState(false)
    const [forceUpdate, setForceUpdate]   = useState(false)
    const [updateInfo, setUpdateInfo]     = useState({ latestVersion: '', downloadUrl: '' })
    const hydrate = useAuthStore(s => s.hydrate)
    const hydrateTheme = useThemeStore(s => s.hydrate)
    const hydrateLocale = useLocaleStore(s => s.hydrate)
    const exitModalOpen = useUiStore(s => s.exitModalOpen)
    const exitModalSource = useUiStore(s => s.exitModalSource)
    const logoutModalOpen = useUiStore(s => s.logoutModalOpen)
    const openExitModal = useUiStore(s => s.openExitModal)
    const openLogoutModal = useUiStore(s => s.openLogoutModal)
    const closeExitModal = useUiStore(s => s.closeExitModal)
    const closeLogoutModal = useUiStore(s => s.closeLogoutModal)
    const logout = useAuthStore(s => s.logout)
    useEffect(() => {
        hydrateTheme()
        hydrateLocale()
        hydrate()
        initAudio()

        // Version check — 4s timeout fallback so a dead server never blocks the app
        const fallback = setTimeout(() => setVersionReady(true), 4000)
        versionAPI.check()
            .then(res => {
                if (res.data.forceUpdate && isOlderVersion(APP_VERSION, res.data.latestVersion)) {
                    setForceUpdate(true)
                    setUpdateInfo({
                        latestVersion: res.data.latestVersion,
                        downloadUrl:   res.data.downloadUrl,
                    })
                }
            })
            .catch(() => {})
            .finally(() => { clearTimeout(fallback); setVersionReady(true) })

        window.electron?.netbird.onInstallRequired(() => {
            console.log('NetBird install required')
        })

        window.electron?.window.onCloseRequest(() => {
            openExitModal()
        })

        window.electron?.window.onQuitting?.(() => {
            openExitModal()
            setQuitting(true)
        })
    }, [openExitModal])

    async function handleQuit() {
        setQuitting(true)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        try {
            await window.electron?.window.quit()
        } catch (err) {
            console.error('Quit error:', err)
            setQuitting(false)
        }
    }

    function handleMinimize() {
        closeExitModal()
        window.electron?.window.minimizeToTray()
    }

    function handleCancel() {
        closeExitModal()
    }

    function handleExitToLogout() {
        closeExitModal()
        openLogoutModal()
    }

    async function handleLogoutConfirm() {
        setLoggingOut(true)
        await logout()
        setLoggingOut(false)
        closeLogoutModal()
    }

    function handleLogoutCancel() {
        closeLogoutModal()
    }

    if (!versionReady) return <LoadingScreen />
    if (forceUpdate) return (
        <UpdateBlockScreen
            currentVersion={APP_VERSION}
            latestVersion={updateInfo.latestVersion}
        />
    )

    return (
        <HashRouter>
            <PresenceProvider>
                <SettingsLoader />
                <LobbySession />
                <SetupRunner />
                <UpdateNotifier />
                <div className="h-screen flex flex-col bg-gn-bg overflow-hidden">
                    <TitleBar />
                    <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col overflow-hidden">
                        <Routes>
                            <Route path="/auth"    element={<AuthPage />} />
                            <Route path="/setup"   element={<Navigate to="/home" replace />} />
                            <Route path="/home"    element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                            <Route path="/rooms"   element={<ProtectedRoute><LobbyListPage /></ProtectedRoute>} />
                            <Route path="/lobby/:groupId" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
                            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                            <Route path="/admin"   element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                            <Route path="*"        element={<RootRedirect />} />
                        </Routes>
                    </div>

                    <Notifications />

                    {exitModalOpen && (
                        <ExitModal
                            source={exitModalSource}
                            onQuit={handleQuit}
                            onMinimize={handleMinimize}
                            onLogout={handleExitToLogout}
                            onCancel={handleCancel}
                            quitting={quitting}
                        />
                    )}

                    {(logoutModalOpen || loggingOut) && (
                        <LogoutModal
                            onConfirm={handleLogoutConfirm}
                            onCancel={handleLogoutCancel}
                            loggingOut={loggingOut}
                        />
                    )}
                </div>
            </PresenceProvider>
        </HashRouter>
    )
}