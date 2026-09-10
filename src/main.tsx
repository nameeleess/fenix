import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerFenixPwa } from './pwa'
import './styles/global.css'
import './styles/design-system.css'

registerFenixPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
