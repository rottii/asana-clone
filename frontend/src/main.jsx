import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PublicDashboardView from './components/PublicDashboardView'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const path = window.location.pathname;

if (path.startsWith('/public/dashboard/')) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <PublicDashboardView />
    </React.StrictMode>
  )
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </React.StrictMode>,
  )
}