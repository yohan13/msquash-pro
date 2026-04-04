import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminGetUsers, adminGetStats, adminUpdateRole, adminResetPassword, adminDeleteUser } from '../api'
import Banner from '../components/Banner'
import Modal from '../components/Modal'
import { useBanner } from '../hooks/useBanner'

export default function Admin() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { banner, setBanner, clearBanner } = useBanner()

  const [tab, setTab]         = useState('stats')
  const [stats, setStats]     = useState(null)
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(false)

  const [toDelete, setToDelete]     = useState(null)
  const [resetTarget, setReset]     = useState(null)
  const [newPassword, setNewPw]     = useState('')

  if (!user || user.role !== 'ADMIN') {
    navigate('/')
    return null
  }

  async function loadStats() {
    setLoading(true)
    try { setStats(await adminGetStats()) }
    catch (e) { setBanner('error', 'Erreur chargement stats.') }
    finally { setLoading(false) }
  }

  async function loadUsers() {
    setLoading(true)
    try { const r = await adminGetUsers(); setUsers(r.users || []) }
    catch (e) { setBanner('error', 'Erreur chargement utilisateurs.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'stats') loadStats()
    else loadUsers()
  }, [tab])

  async function handleRoleToggle(u) {
    const newRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
    try {
      await adminUpdateRole(u.id, newRole)
      setBanner('success', `${u.name} est maintenant ${newRole === 'ADMIN' ? 'Admin' : 'Membre'}.`)
      await loadUsers()
    } catch (e) { setBanner('error', e.message === 'CANNOT_DEMOTE_SELF' ? 'Impossible de se rétrograder soi-même.' : 'Erreur.') }
  }

  async function handleDeleteConfirm() {
    if (!toDelete) return
    try {
      await adminDeleteUser(toDelete.id)
      setBanner('success', `${toDelete.name} supprimé.`)
      setToDelete(null)
      await loadUsers()
    } catch { setBanner('error', 'Erreur lors de la suppression.') }
  }

  async function handleResetPw(e) {
    e.preventDefault()
    if (!resetTarget || newPassword.length < 6) return
    try {
      await adminResetPassword(resetTarget.id, newPassword)
      setBanner('success', `Mot de passe de ${resetTarget.name} réinitialisé.`)
      setReset(null); setNewPw('')
    } catch { setBanner('error', 'Erreur lors de la réinitialisation.') }
  }

  const tabBtn = (key, label) => (
    <button type="button"
            className={`btn text-sm ${tab === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(key)}>
      {label}
    </button>
  )

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Administration</h1>
        <div className="toolbar">{tabBtn('stats', '📊 Statistiques')}{tabBtn('users', '👥 Membres')}</div>
      </div>

      {banner && <Banner banner={banner} onClose={clearBanner} />}

      <Modal
        open={!!toDelete}
        title={`Supprimer ${toDelete?.name} ?`}
        message="Toutes ses réservations seront supprimées. Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />

      {/* ─── Stats ─── */}
      {tab === 'stats' && (
        loading ? <div className="text-ink-muted text-sm">Chargement…</div> :
        stats && <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total réservations', value: stats.totalBookings,  color: 'bg-blue-50 border-blue-100' },
              { label: 'À venir',            value: stats.futureBookings, color: 'bg-green-50 border-green-100' },
              { label: 'Membres',            value: stats.totalUsers,     color: 'bg-purple-50 border-purple-100' },
              { label: 'Créneaux bloqués',   value: stats.totalBlocks,    color: 'bg-orange-50 border-orange-100' },
            ].map(k => (
              <div key={k.label} className={`card border ${k.color}`}>
                <div className="card-body py-3">
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Bookings per court */}
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Réservations par court</h2></div>
              <div className="card-body space-y-2">
                {stats.bookingsPerCourt.map(r => {
                  const max = Math.max(...stats.bookingsPerCourt.map(x => x.count), 1)
                  return (
                    <div key={r.court}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span>{r.court}</span>
                        <span className="font-semibold">{r.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top members */}
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Top membres</h2></div>
              <div className="card-body space-y-2">
                {stats.topUsers.slice(0, 8).map((u, i) => (
                  <div key={u.email} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-muted w-4 text-right text-xs">{i + 1}.</span>
                      <span>{u.name}</span>
                    </div>
                    <span className="chip">{u.count} résa</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity last 30 days */}
          {stats.last30days.length > 0 && (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Activité — 30 derniers jours</h2></div>
              <div className="card-body">
                <div className="flex items-end gap-1 h-24">
                  {stats.last30days.map(d => {
                    const max = Math.max(...stats.last30days.map(x => x.count), 1)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.count}`}>
                        <div className="w-full bg-brand/80 rounded-sm" style={{ height: `${(d.count / max) * 80}px`, minHeight: '2px' }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-ink-muted mt-1">
                  <span>{stats.last30days[0]?.date}</span>
                  <span>{stats.last30days[stats.last30days.length - 1]?.date}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Users ─── */}
      {tab === 'users' && (
        loading ? <div className="text-ink-muted text-sm">Chargement…</div> :
        <>
          {/* Reset password panel */}
          {resetTarget && (
            <div className="card border border-blue-200 bg-blue-50">
              <div className="card-body">
                <h3 className="font-semibold text-sm mb-2">Réinitialiser le mot de passe de {resetTarget.name}</h3>
                <form onSubmit={handleResetPw} className="flex gap-2">
                  <input className="field flex-1" type="password" required minLength={6}
                         placeholder="Nouveau mot de passe (6 car. min)"
                         value={newPassword} onChange={e => setNewPw(e.target.value)} />
                  <button type="submit" className="btn btn-primary">Confirmer</button>
                  <button type="button" className="btn btn-outline" onClick={() => { setReset(null); setNewPw('') }}>Annuler</button>
                </form>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-sm">{users.length} membre(s)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-ink-muted">
                    <th className="px-4 py-3 text-left font-medium">Membre</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-center font-medium">Rôle</th>
                    <th className="px-4 py-3 text-center font-medium">Réservations</th>
                    <th className="px-4 py-3 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`chip text-xs ${u.role === 'ADMIN' ? 'bg-yellow-100 text-yellow-700' : ''}`}>
                          {u.role === 'ADMIN' ? '⭐ Admin' : 'Membre'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-ink-muted">{u.booking_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" className="btn btn-outline text-xs px-2 py-1"
                                  onClick={() => handleRoleToggle(u)}>
                            {u.role === 'ADMIN' ? '→ Membre' : '→ Admin'}
                          </button>
                          <button type="button" className="btn btn-soft text-xs px-2 py-1"
                                  onClick={() => setReset(u)}>
                            Mot de passe
                          </button>
                          {u.id !== user.id && (
                            <button type="button"
                                    className="btn text-xs px-2 py-1 border-transparent text-white bg-red-500 hover:bg-red-600"
                                    onClick={() => setToDelete(u)}>
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
