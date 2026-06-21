import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMobileLifecycleBroker } from './shared/lifecycle-broker'

// Initialize Capacitor background/foreground lifecycle listener
initMobileLifecycleBroker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
