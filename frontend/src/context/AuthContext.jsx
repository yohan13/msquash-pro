import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { me } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setUser(null); setLoading(false); return }
    try {
      const r = await me()
      setUser(r.user)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    const handler = () => reload()
    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [reload])

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
    window.dispatchEvent(new Event('auth-changed'))
  }

  function loginSuccess(token, userData) {
    localStorage.setItem('token', token)
    setUser(userData)
    window.dispatchEvent(new Event('auth-changed'))
  }

  return (
    <AuthContext.Provider value={{ user, loading, reload, logout, loginSuccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
