import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import App from './App'
import { installAiFetch } from './lib/aiFetch'
import './styles.css'
import './tos.css'
import './assessment.css'
import './results.css'
import './results-report.css'

installAiFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
