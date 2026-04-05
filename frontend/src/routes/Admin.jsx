import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminGetUsers, adminGetStats, adminUpdateRole, adminResetPassword, adminDeleteUser,
         adminGetSubscriptions, adminCreateSubscription, adminDeleteSubscription,
         adminGetRevenue } from '../api'
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

  // Subscriptions
  const [subs, setSubs]           = useState([])
  const [subUsers, setSubUsers]   = useState([])
  const [cardTypes, setCardTypes] = useState({})
  const [newSub, setNewSub]       = useState({ userId: '', cardType: '' })
  const [subToDelete, setSubToDelete] = useState(null)

  // Revenue
  const [revenue, setRevenue] = useState(null)

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

  async function loadSubs() {
    setLoading(true)
    try {
      const r = await adminGetSubscriptions()
      setSubs(r.subscriptions || [])
      setCardTypes(r.cardTypes || {})
      // Récupérer la liste des membres pour le formulaire
      const ru = await adminGetUsers()
      setSubUsers((ru.users || []).filter(u => u.role === 'USER'))
    }
    catch (e) { setBanner('error', 'Erreur chargement abonnements.') }
    finally { setLoading(false) }
  }

  async function loadRevenue() {
    setLoading(true)
    try { setRevenue(await adminGetRevenue()) }
    catch { setBanner('error', 'Erreur chargement revenus.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'stats')    loadStats()
    else if (tab === 'users')    loadUsers()
    else if (tab === 'subs')     loadSubs()
    else if (tab === 'revenue')  loadRevenue()
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
        <div className="toolbar">{tabBtn('stats', '📊 Statistiques')}{tabBtn('revenue', '💰 Revenus')}{tabBtn('users', '👥 Membres')}{tabBtn('subs', '🎫 Abonnements')}</div>
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

      {/* ─── Revenus ─── */}
      {tab === 'revenue' && (
        loading ? <div className="text-ink-muted text-sm">Chargement…</div> :
        revenue && <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'CA total',          value: `${revenue.totalRevenue} €`,       color: 'bg-green-50 border-green-100' },
              { label: 'CA ce mois',         value: `${revenue.currentMonthRevenue} €`, color: 'bg-blue-50 border-blue-100' },
              { label: 'Cartes vendues',     value: revenue.totalCardsSold,             color: 'bg-purple-50 border-purple-100' },
              { label: 'Taux utilisation',   value: `${revenue.utilizationRate} %`,     color: 'bg-orange-50 border-orange-100' },
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
            {/* Répartition par type de carte */}
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Répartition par type de carte</h2></div>
              <div className="card-body space-y-4">
                {revenue.byCardType.length === 0
                  ? <p className="text-sm text-ink-muted">Aucune vente.</p>
                  : revenue.byCardType.map(ct => {
                      const maxRev = Math.max(...revenue.byCardType.map(x => x.revenue), 1)
                      return (
                        <div key={ct.cardType}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{ct.label}</span>
                            <span className="text-brand font-bold">{ct.revenue} €</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'var(--panel-alt)' }}>
                            <div className="h-full bg-brand rounded-full transition-all"
                                 style={{ width: `${(ct.revenue / maxRev) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-ink-muted">
                            <span>{ct.count} carte{ct.count > 1 ? 's' : ''} · {ct.price} €/carte</span>
                            <span>Utilisation : {ct.utilizationRate} %</span>
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>

            {/* Top acheteurs */}
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Top acheteurs</h2></div>
              <div className="card-body space-y-2">
                {revenue.topSpenders.length === 0
                  ? <p className="text-sm text-ink-muted">Aucun achat.</p>
                  : revenue.topSpenders.map((s, i) => {
                      const maxRev = Math.max(...revenue.topSpenders.map(x => x.revenue), 1)
                      return (
                        <div key={s.email}>
                          <div className="flex items-center justify-between text-sm mb-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-ink-muted w-4 text-right text-xs">{i + 1}.</span>
                              <span className="font-medium">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="chip text-xs">{s.cards} carte{s.cards > 1 ? 's' : ''}</span>
                              <span className="font-bold text-brand text-xs">{s.revenue} €</span>
                            </div>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden ml-6" style={{ background: 'var(--panel-alt)' }}>
                            <div className="h-full bg-brand/60 rounded-full" style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          </div>

          {/* Tendance mensuelle */}
          {revenue.monthlyRevenue.length > 0 && (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-sm">Tendance mensuelle — 12 derniers mois</h2></div>
              <div className="card-body">
                <div className="flex items-end gap-1.5 h-28">
                  {revenue.monthlyRevenue.map(m => {
                    const maxR = Math.max(...revenue.monthlyRevenue.map(x => x.revenue), 1)
                    const barH = Math.max((m.revenue / maxR) * 96, 3)
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group"
                           title={`${m.month} : ${m.revenue} € (${m.count} carte${m.count > 1 ? 's' : ''})`}>
                        <span className="text-[9px] text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {m.revenue} €
                        </span>
                        <div className="w-full bg-brand/70 rounded-t-sm hover:bg-brand transition-colors"
                             style={{ height: `${barH}px` }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-ink-muted mt-1">
                  <span>{revenue.monthlyRevenue[0]?.month}</span>
                  <span>{revenue.monthlyRevenue[revenue.monthlyRevenue.length - 1]?.month}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Abonnements ─── */}
      {tab === 'subs' && (
        loading ? <div className="text-ink-muted text-sm">Chargement…</div> :
        <>
          {/* Formulaire ajout */}
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-sm">Créditer une carte</h2></div>
            <div className="card-body">
              <form className="flex flex-wrap gap-3 items-end"
                    onSubmit={async e => {
                      e.preventDefault()
                      if (!newSub.userId || !newSub.cardType) return
                      try {
                        await adminCreateSubscription(newSub)
                        setBanner('success', 'Carte créditée.')
                        setNewSub({ userId: '', cardType: '' })
                        await loadSubs()
                      } catch { setBanner('error', 'Erreur lors du crédit.') }
                    }}>
                <div>
                  <label className="text-xs font-medium block mb-1">Membre</label>
                  <select className="field" value={newSub.userId} onChange={e => setNewSub(s => ({ ...s, userId: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {subUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Type de carte</label>
                  <select className="field" value={newSub.cardType} onChange={e => setNewSub(s => ({ ...s, cardType: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {Object.entries(cardTypes).map(([key, ct]) => (
                      <option key={key} value={key}>{ct.label} — {ct.units} séances — {ct.price}€</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Créditer</button>
              </form>
            </div>
          </div>

          {/* Liste des abonnements */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-sm">{subs.length} abonnement(s)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-ink-muted" style={{ background: 'var(--panel-alt)' }}>
                    <th className="px-4 py-3 text-left font-medium">Membre</th>
                    <th className="px-4 py-3 text-left font-medium">Carte</th>
                    <th className="px-4 py-3 text-center font-medium">Solde</th>
                    <th className="px-4 py-3 text-center font-medium">Progression</th>
                    <th className="px-4 py-3 text-center font-medium">Expiration</th>
                    <th className="px-4 py-3 text-center font-medium">Statut</th>
                    <th className="px-4 py-3 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => {
                    const today     = new Date().toISOString().slice(0, 10)
                    const remaining = s.total_units - s.used_units
                    const expired   = s.expires_at < today
                    const empty     = remaining <= 0
                    const pct       = Math.round((remaining / s.total_units) * 100)
                    const cardLabel = s.card_type.replace('CARD_', 'Carte ').replace('FORFAIT_CLUB', 'Forfait Club').replace('_', ' ')
                    return (
                      <tr key={s.id} className="border-b hover:bg-[var(--panel-alt)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.user_name}</div>
                          <div className="text-xs text-ink-muted">{s.user_email}</div>
                        </td>
                        <td className="px-4 py-3">{cardLabel}</td>
                        <td className="px-4 py-3 text-center font-semibold text-brand">{remaining} / {s.total_units}</td>
                        <td className="px-4 py-3 w-32">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--panel-alt)' }}>
                            <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-ink-muted text-xs">{s.expires_at}</td>
                        <td className="px-4 py-3 text-center">
                          {expired ? <span className="chip bg-red-100 text-red-600 text-xs">Expirée</span>
                           : empty ? <span className="chip bg-orange-100 text-orange-600 text-xs">Épuisée</span>
                           : <span className="chip bg-green-100 text-green-700 text-xs">Active</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {subToDelete?.id === s.id ? (
                            <div className="flex gap-1 justify-center">
                              <button type="button" className="btn text-xs px-2 py-1 bg-red-500 text-white border-transparent"
                                      onClick={async () => {
                                        try { await adminDeleteSubscription(s.id); await loadSubs(); setBanner('success', 'Abonnement supprimé.') }
                                        catch { setBanner('error', 'Erreur suppression.') }
                                        setSubToDelete(null)
                                      }}>Confirmer</button>
                              <button type="button" className="btn btn-outline text-xs px-2 py-1"
                                      onClick={() => setSubToDelete(null)}>Annuler</button>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-outline text-xs px-2 py-1 text-red-500"
                                    onClick={() => setSubToDelete(s)}>Supprimer</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {subs.length === 0 && (
                <div className="text-center py-8 text-ink-muted text-sm">Aucun abonnement.</div>
              )}
            </div>
          </div>
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
