import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateProfile, mySubscriptions } from '../api'
import Banner from '../components/Banner'
import { useBanner } from '../hooks/useBanner'
import MyBookings from '../components/MyBookings'

export default function Profile() {
  const { user, reload, logout } = useAuth()
  const navigate = useNavigate()
  const { banner, setBanner, clearBanner } = useBanner()

  const [nameForm, setNameForm] = useState({ name: user?.name || '' })
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [busyName, setBusyName]   = useState(false)
  const [busyPw, setBusyPw]       = useState(false)
  const [subscriptions, setSubs]  = useState([])

  useEffect(() => {
    if (!user) return
    mySubscriptions().then(r => setSubs(r.subscriptions || [])).catch(() => {})
  }, [user])

  if (!user) {
    navigate('/')
    return null
  }

  async function handleName(e) {
    e.preventDefault()
    if (!nameForm.name.trim()) return
    setBusyName(true)
    try {
      const r = await updateProfile({ name: nameForm.name.trim() })
      localStorage.setItem('token', r.token)
      await reload()
      setBanner('success', 'Nom mis à jour.')
    } catch (e) {
      setBanner('error', 'Erreur lors de la mise à jour.')
    } finally { setBusyName(false) }
  }

  async function handlePassword(e) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) {
      setBanner('error', 'Les mots de passe ne correspondent pas.')
      return
    }
    if (pwForm.newPassword.length < 6) {
      setBanner('error', 'Mot de passe trop court (6 caractères minimum).')
      return
    }
    setBusyPw(true)
    try {
      const r = await updateProfile({
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      })
      localStorage.setItem('token', r.token)
      await reload()
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setBanner('success', 'Mot de passe modifié.')
    } catch (err) {
      const msgs = {
        WRONG_PASSWORD:           'Mot de passe actuel incorrect.',
        CURRENT_PASSWORD_REQUIRED:'Saisir le mot de passe actuel.',
        WEAK_PASSWORD:            'Nouveau mot de passe trop court.',
      }
      setBanner('error', msgs[err.message] || 'Erreur.')
    } finally { setBusyPw(false) }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-xl font-bold">Mon profil</h1>

      {banner && <Banner banner={banner} onClose={clearBanner} />}

      {/* Info card */}
      <div className="card">
        <div className="card-body flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center text-2xl font-bold text-brand">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{user.name}</div>
            <div className="text-sm text-ink-muted">{user.email}</div>
            <div className="mt-1">
              <span className={`chip text-xs ${user.role === 'ADMIN' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                {user.role === 'ADMIN' ? '⭐ Admin' : 'Membre'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Change name */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-sm">Modifier le nom</h2></div>
        <div className="card-body">
          <form onSubmit={handleName} className="flex gap-2">
            <input className="field flex-1" value={nameForm.name}
                   onChange={e => setNameForm({ name: e.target.value })}
                   placeholder="Nom complet" required />
            <button type="submit" className="btn btn-primary" disabled={busyName}>
              {busyName ? '…' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-sm">Changer le mot de passe</h2></div>
        <div className="card-body">
          <form onSubmit={handlePassword} className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Mot de passe actuel</label>
              <input className="field" type="password" required
                     value={pwForm.currentPassword}
                     onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Nouveau mot de passe</label>
              <input className="field" type="password" required minLength={6}
                     value={pwForm.newPassword}
                     onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Confirmer</label>
              <input className="field" type="password" required minLength={6}
                     value={pwForm.confirm}
                     onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busyPw}>
              {busyPw ? 'Mise à jour…' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>
      </div>

      {/* Abonnements */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-sm">Mes cartes & abonnements</h2></div>
        <div className="card-body">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune carte active. Contactez le club pour en acheter une.</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map(s => {
                const today = new Date().toISOString().slice(0, 10)
                const remaining = s.total_units - s.used_units
                const expired = s.expires_at < today
                const empty   = remaining <= 0
                const pct     = Math.round((remaining / s.total_units) * 100)
                const cardLabel = s.card_type
                  .replace('CARD_', 'Carte ')
                  .replace('FORFAIT_CLUB', 'Forfait Club')
                  .replace('_', ' ')
                return (
                  <div key={s.id} className={`rounded-xl border p-4 ${expired || empty ? 'opacity-50' : ''}`}
                       style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-sm">{cardLabel}</span>
                        {expired && <span className="ml-2 chip text-xs bg-red-100 text-red-600">Expirée</span>}
                        {empty   && !expired && <span className="ml-2 chip text-xs bg-orange-100 text-orange-600">Épuisée</span>}
                        {!expired && !empty  && <span className="ml-2 chip text-xs bg-green-100 text-green-700">Active</span>}
                      </div>
                      <span className="text-sm font-bold text-brand">{remaining} / {s.total_units} séances</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel-alt)' }}>
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {s.used_units} utilisée{s.used_units > 1 ? 's' : ''} · Expire le {s.expires_at}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Réservations */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-sm">Mes réservations</h2></div>
        <div className="card-body">
          <MyBookings user={user} refresh={0} />
        </div>
      </div>
    </main>
  )
}
