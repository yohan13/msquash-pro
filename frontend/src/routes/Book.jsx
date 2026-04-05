import React, { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getConfig, getDay, createBooking, deleteBooking, createBlock, deleteBlock, exportCSV, getMembers, mySubscriptions } from '../api'
import { useAuth } from '../context/AuthContext'
import SlotGrid from '../components/SlotGrid'
import MyBookings from '../components/MyBookings'
import Banner from '../components/Banner'
import { useBanner } from '../hooks/useBanner'

function toISODate(d) { return d.toISOString().slice(0, 10) }

export default function Book() {
  const { user }            = useAuth()
  const { setAuthOpen }     = useOutletContext() || {}
  const { banner, setBanner, clearBanner } = useBanner()

  const [cfg, setCfg]           = useState(null)
  const [date, setDate]         = useState(() => toISODate(new Date()))
  const [dayData, setDayData]   = useState({ bookings: [], blocks: [] })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [note, setNote]         = useState('')
  const [reason, setReason]     = useState('')
  const [refresh, setRefresh]   = useState(0)

  // Player 2
  const [members, setMembers]         = useState([])
  const [player2Mode, setPlayer2Mode] = useState('none') // 'none' | 'member' | 'guest'
  const [player2Id, setPlayer2Id]     = useState('')
  const [player2Name, setPlayer2Name] = useState('')

  // Abonnement
  const [subscription, setSubscription] = useState(null)
  const [unitsPaid, setUnitsPaid]       = useState(1) // 0 = sans carte, 1 = moi seul, 2 = je couvre les deux

  // Export dates
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo]     = useState(() => toISODate(new Date(Date.now() + 7 * 86400000)))

  useEffect(() => {
    getConfig().then(setCfg).catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!user) return
    getMembers().then(r => setMembers(r.members || [])).catch(() => {})
    mySubscriptions().then(r => {
      const today = new Date().toISOString().slice(0, 10)
      const active = (r.subscriptions || []).find(s => s.expires_at >= today && s.used_units < s.total_units)
      setSubscription(active || null)
    }).catch(() => {})
  }, [user])

  async function loadDay() {
    if (!cfg) return
    setLoading(true)
    try { setDayData(await getDay(date)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDay() }, [cfg, date])

  const isAdmin = user?.role === 'ADMIN'

  const resolvedPlayer2Id   = player2Mode === 'member' ? player2Id : null
  const resolvedPlayer2Name = player2Mode === 'guest'  ? player2Name.trim() || null : null

  async function handleReserve(courtId, time) {
    if (!user) { setAuthOpen?.(true); return }
    try {
      await createBooking({
        date, time, courtId,
        note:        note.trim() || null,
        player2Id:   resolvedPlayer2Id   || undefined,
        player2Name: resolvedPlayer2Name || undefined,
        unitsPaid:   subscription ? unitsPaid : 0,
      })
      await loadDay()
      setRefresh(r => r + 1)
      // Rafraîchir le solde abonnement
      mySubscriptions().then(r => {
        const today = new Date().toISOString().slice(0, 10)
        const active = (r.subscriptions || []).find(s => s.expires_at >= today && s.used_units < s.total_units)
        setSubscription(active || null)
      }).catch(() => {})
      const p2Label = player2Mode === 'member'
        ? members.find(m => m.id === player2Id)?.name
        : player2Name.trim() || null
      setBanner('success', `Court ${courtId} réservé à ${time}${p2Label ? ` vs ${p2Label}` : ''} ✓`)
    } catch (e) {
      const msgs = {
        ALREADY_BOOKED:                    'Ce créneau est déjà pris.',
        SLOT_BLOCKED:                      'Ce créneau est bloqué.',
        BOOKING_LIMIT_REACHED:             `Limite de ${cfg?.rules?.MAX_FUTURE_BOOKINGS} réservations atteinte.`,
        USER_ALREADY_BOOKED_THIS_TIMESLOT: 'Vous avez déjà une réservation à cet horaire.',
        OUT_OF_WINDOW:                     `Réservation impossible au-delà de J+${cfg?.rules?.MAX_DAYS_AHEAD}.`,
        PLAYER2_NOT_FOUND:                 'Adversaire introuvable.',
        PLAYER2_SAME_AS_PLAYER1:           'Vous ne pouvez pas vous choisir comme adversaire.',
      }
      setBanner('error', msgs[e.message] || e.message)
    }
  }

  async function handleCancel(booking) {
    try {
      await deleteBooking(booking.id)
      await loadDay()
      setRefresh(r => r + 1)
      mySubscriptions().then(r => {
        const today = new Date().toISOString().slice(0, 10)
        const active = (r.subscriptions || []).find(s => s.expires_at >= today && s.used_units < s.total_units)
        setSubscription(active || null)
      }).catch(() => {})
      setBanner('success', 'Réservation annulée.')
    } catch (e) { setBanner('error', e.message) }
  }

  async function handleToggleBlock(courtId, time) {
    const bl = dayData.blocks.find(b => b.court_id === courtId && b.time === time)
    try {
      if (bl) {
        await deleteBlock(bl.id)
        setBanner('success', 'Créneau débloqué.')
      } else {
        await createBlock({ date, time, courtId, reason: reason.trim() || null })
        setBanner('success', 'Créneau bloqué.')
      }
      await loadDay()
    } catch (e) {
      const msgs = { BOOKING_EXISTS: 'Une réservation existe déjà sur ce créneau.' }
      setBanner('error', msgs[e.message] || e.message)
    }
  }

  async function handleExport() {
    try {
      const blob = await exportCSV(from, to)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `export_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      setBanner('success', 'Export CSV téléchargé.')
    } catch { setBanner('error', "Erreur lors de l'export.") }
  }

  function changeDate(delta) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toISODate(d))
  }

  if (error) return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
        Erreur de chargement : {error}
      </div>
    </div>
  )

  if (!cfg) return (
    <div className="max-w-7xl mx-auto p-6 flex items-center gap-3 text-ink-muted">
      <div className="animate-spin w-5 h-5 border-2 border-brand border-t-transparent rounded-full" />
      Chargement…
    </div>
  )

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const remaining = subscription ? subscription.total_units - subscription.used_units : 0

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {banner && <Banner banner={banner} onClose={clearBanner} />}

      {/* Options de réservation */}
      <section className="card">
        <div className="card-header">
          <h2 className="font-semibold">Options de réservation</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Note */}
            <div>
              <label className="text-sm font-medium block mb-1">Note (optionnelle)</label>
              <input className="field" placeholder="Ex: match classé, entraînement…"
                     value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {/* Admin : raison blocage */}
            {isAdmin && (
              <div>
                <label className="text-sm font-medium block mb-1">Raison de blocage</label>
                <input className="field" placeholder="Ex: Tournoi, entretien court…"
                       value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            )}
          </div>

          {/* Adversaire */}
          {user && (
            <div>
              <label className="text-sm font-medium block mb-1">Adversaire</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { value: 'none',   label: 'Non renseigné' },
                  { value: 'member', label: 'Membre du club' },
                  { value: 'guest',  label: 'Invité (nom libre)' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                          className={`btn text-xs px-3 py-1 ${player2Mode === opt.value ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setPlayer2Mode(opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {player2Mode === 'member' && (
                <select className="field w-full max-w-xs"
                        value={player2Id} onChange={e => setPlayer2Id(e.target.value)}>
                  <option value="">— Choisir un membre —</option>
                  {members.filter(m => m.id !== user?.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
              {player2Mode === 'guest' && (
                <input className="field w-full max-w-xs"
                       placeholder="Prénom Nom de l'invité"
                       value={player2Name} onChange={e => setPlayer2Name(e.target.value)} />
              )}
            </div>
          )}

          {/* Abonnement / unités */}
          {user && subscription && (
            <div className="rounded-xl border p-3 flex flex-wrap items-center gap-4"
                 style={{ borderColor: 'var(--border)', background: 'var(--panel-alt)' }}>
              <div>
                <div className="text-xs text-ink-muted">Ma carte</div>
                <div className="text-sm font-semibold">{subscription.card_type.replace('_', ' ')} — <span className="text-brand">{remaining} séance{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}</span></div>
                <div className="text-xs text-ink-muted">Expire le {subscription.expires_at}</div>
              </div>
              <div>
                <div className="text-xs text-ink-muted mb-1">Utiliser ma carte</div>
                <div className="flex gap-2">
                  {[
                    { v: 0, label: 'Non' },
                    { v: 1, label: '1 séance (je paie pour moi)' },
                    { v: 2, label: '2 séances (je couvre les deux)' },
                  ].map(opt => (
                    <button key={opt.v} type="button"
                            className={`btn text-xs px-2 py-1 ${unitsPaid === opt.v ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUnitsPaid(opt.v)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {user && !subscription && (
            <div className="text-xs text-ink-muted bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              Aucune carte active — paiement à la séance au club (14€/pers).
            </div>
          )}

          <div className="text-xs text-ink-muted bg-[var(--panel-alt)] rounded-xl px-3 py-2">
            Règles : max <strong>{cfg.rules.MAX_FUTURE_BOOKINGS}</strong> réservations à venir
            {' '}• fenêtre <strong>{cfg.rules.MAX_DAYS_AHEAD}</strong> jours
            {' '}• {cfg.rules.UNIQUE_PER_TIMESLOT ? '1 court par créneau horaire' : 'plusieurs courts autorisés par horaire'}
          </div>
        </div>
      </section>

      {/* Grille */}
      <section className="card">
        <div className="card-header flex flex-wrap gap-3 items-center justify-between">
          <h2 className="font-semibold capitalize">{dateLabel}</h2>
          <div className="toolbar">
            <button type="button" className="btn btn-outline text-sm" onClick={() => changeDate(-1)}>← Jour</button>
            <input type="date" className="field w-40 text-sm"
                   value={date} onChange={e => setDate(e.target.value)} />
            <button type="button" className="btn btn-outline text-sm" onClick={() => changeDate(1)}>Jour →</button>
            <button type="button" className="btn btn-outline text-sm" onClick={loadDay} title="Rafraîchir">↻</button>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center gap-3 p-5 text-ink-muted text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
              Chargement des créneaux…
            </div>
          ) : (
            <SlotGrid
              cfg={cfg}
              date={date}
              dayData={dayData}
              user={user}
              note={note}
              reason={reason}
              onReserve={handleReserve}
              onCancel={handleCancel}
              onToggleBlock={isAdmin ? handleToggleBlock : null}
              loading={loading}
            />
          )}
        </div>
      </section>

      {/* Mes réservations */}
      <section className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Mes réservations</h2>
          {isAdmin && (
            <div className="toolbar">
              <span className="text-xs text-ink-muted">Export :</span>
              <input type="date" className="field w-36 text-sm" value={from} onChange={e => setFrom(e.target.value)} />
              <span className="text-xs text-ink-muted">→</span>
              <input type="date" className="field w-36 text-sm" value={to} onChange={e => setTo(e.target.value)} />
              <button type="button" className="btn btn-outline text-sm" onClick={handleExport}>⬇ CSV</button>
            </div>
          )}
        </div>
        <div className="card-body">
          <MyBookings user={user} refresh={refresh} />
        </div>
      </section>
    </main>
  )
}
