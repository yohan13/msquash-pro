import React, { useState } from 'react'
import { login, register } from '../api'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ open, onClose, onSuccess }) {
  const { loginSuccess } = useAuth()
  const [mode, setMode]   = useState('login')
  const [form, setForm]   = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy]   = useState(false)

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = mode === 'register'
        ? await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
        : await login({ email: form.email.trim(), password: form.password })
      loginSuccess(result.token, result.user)
      setForm({ name: '', email: '', password: '' })
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const messages = {
        INVALID_NAME:    'Nom invalide.',
        INVALID_EMAIL:   'Email invalide.',
        WEAK_PASSWORD:   'Mot de passe trop court (6 caractères minimum).',
        EMAIL_TAKEN:     'Cet email est déjà utilisé.',
        BAD_CREDENTIALS: 'Email ou mot de passe incorrect.',
      }
      setError(messages[err.message] || 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="text-sm font-medium block mb-1">Nom complet</label>
              <input className="field" placeholder="Ex: Marie Dupont" required
                     value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <input className="field" type="email" placeholder="vous@example.com" required
                   value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Mot de passe</label>
            <input className="field" type="password" placeholder="••••••••" required minLength={6}
                   value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Chargement…' : mode === 'register' ? 'Créer le compte' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          {mode === 'login' ? (
            <>Pas encore membre ?{' '}
              <button type="button" className="text-brand font-medium hover:underline" onClick={() => setMode('register')}>
                Créer un compte
              </button>
            </>
          ) : (
            <>Déjà membre ?{' '}
              <button type="button" className="text-brand font-medium hover:underline" onClick={() => setMode('login')}>
                Se connecter
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
