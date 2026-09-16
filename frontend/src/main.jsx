import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

const registerServiceWorker = () => {
    registerSW({ immediate: true })
}

if (document.readyState === 'complete') {
    registerServiceWorker()
} else {
    window.addEventListener('load', registerServiceWorker, { once: true })
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <HelmetProvider>
            <App />
        </HelmetProvider>
    </StrictMode>,
)