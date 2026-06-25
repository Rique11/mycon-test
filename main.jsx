import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { installMock } = await import('./services/mockApi.js')
    installMock()
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
