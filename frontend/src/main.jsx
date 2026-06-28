import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const savedTheme = localStorage.getItem('finsight-theme');
if (savedTheme === 'midnight') {
  document.documentElement.setAttribute('data-theme', 'midnight');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
