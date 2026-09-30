import React from 'react'
import ReactDOM from 'react-dom/client'
// Archivo, self-hosted with its width axis: one family, condensed for headings.
import '@fontsource-variable/archivo/wdth.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
