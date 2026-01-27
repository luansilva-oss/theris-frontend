import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ATENÇÃO: Cole seu ID dentro das aspas abaixo.
       NÃO USE CHAVES { }. USE APENAS ASPAS " ".
    */}
    <GoogleOAuthProvider clientId="1029553168345-73cpprt1cgu0qmi119huuo6sjhhbk4sb.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)