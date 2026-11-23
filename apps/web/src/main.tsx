import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/authContext'
import { SubscriptionProvider } from './lib/subscriptionContext'
import { Analytics } from '@vercel/analytics/react'
import { initWebMcp } from './lib/webMcp'

initWebMcp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <App />
        <Analytics />
      </SubscriptionProvider>
    </AuthProvider>
  </StrictMode>,
)

