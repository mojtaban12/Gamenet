import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import OverlayApp from './OverlayApp'
import './i18n'
import { LOCALES, DEFAULT_LOCALE } from './i18n'
import { applyLocale } from './store/localeStore'
import './index.css'

const savedTheme = localStorage.getItem('targame-theme') ?? localStorage.getItem('gamenet-theme')
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark')

const savedLocale = localStorage.getItem('targame-locale')
applyLocale(LOCALES[savedLocale] ? savedLocale : DEFAULT_LOCALE)

const isOverlayWindow = !!window.overlayElectron

if (isOverlayWindow) {
    document.body.style.setProperty('background', 'transparent', 'important')
    document.documentElement.style.setProperty('background', 'transparent', 'important')
    document.getElementById('root').style.setProperty('background', 'transparent', 'important')
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isOverlayWindow ? <OverlayApp /> : <App />}
    </React.StrictMode>
)