import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { resolveAuthFromWindow } from '../utils/authSession'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const applyAuthState = ({ token, email }) => {
      if (token) {
        sessionStorage.setItem('hostJwt', token)
        sessionStorage.removeItem('userEmail')
        localStorage.removeItem('userEmail')
        return
      }

      if (email) {
        localStorage.setItem('userEmail', email)
        sessionStorage.removeItem('hostJwt')
      }
    }

    const { token, email, shouldCleanupUrl, cleanUrl } = resolveAuthFromWindow(window)

    if (token || email) {
      applyAuthState({ token, email })
    }

    if (shouldCleanupUrl) {
      window.history.replaceState({}, '', cleanUrl)
    }

    const maybeLoadUser = () => {
      if (!sessionStorage.getItem('hostJwt') && !localStorage.getItem('userEmail')) {
        setCargando(false)
        return
      }

      api.get('/auth/me')
        .then(({ data }) => setUsuario(data.usuario))
        .catch(() => setUsuario(null))
        .finally(() => setCargando(false))
    }

    maybeLoadUser()

    const handleMessage = (event) => {
      const payload = event?.data
      if (!payload || payload.type !== 'host-auth') return
      if (payload.token || payload.email) {
        applyAuthState({ token: payload.token, email: payload.email })
        maybeLoadUser()
      }
    }

    window.addEventListener('message', handleMessage)

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
