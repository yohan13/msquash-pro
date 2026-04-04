import React, { useEffect, useState } from 'react'
import { myBookings, deleteBooking, bookingICSUrl } from '../api'
import Modal from './Modal'

export default function MyBookings({ user, refresh }) {
  const [bookings, setBookings] = useState([])
  const [toCancel, setToCancel] = useState(null)
  const [error, setError]       = useState(null)

  async function load() {
    if (!user) { setBookings([]); return }
    try { const r = await myBookings(); setBookings(r.bookings || []) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [user, refresh])

  async function confirmCancel() {
    if (!toCancel) return
    try {
      await deleteBooking(toCancel.id)
      setToCancel(null)
      await load()
    } catch (e) { setError(e.message) }
  }

  if (!user) return (
    <div className="text-sm text-ink-muted py-2">
      <a href="#" className="text-brand hover:underline" onClick={e => { e.preventDefault(); window.dispatchEvent(new Event('open-auth')) }}>
        Connecte-toi
      </a>{' '}pour voir tes réservations.
    </div>
  )

  const now = new Date()
  const future = bookings.filter(b => new Date(b.date + 'T' + b.time + ':00') >= now)
  const past   = bookings.filter(b => new Date(b.date + 'T' + b.time + ':00') < now)

  return (
    <>
      <Modal
        open={!!toCancel}
        title="Annuler cette réservation ?"
        message={toCancel ? `${toCancel.date} à ${toCancel.time} — Court ${toCancel.court_id}` : ''}
        confirmLabel="Oui, annuler"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
      />

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {future.length === 0 && past.length === 0 && (
        <div className="text-sm text-ink-muted py-2">Aucune réservation.</div>
      )}

      {future.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">À venir</h4>
          <ul className="space-y-1.5">
            {future.map(b => (
              <li key={b.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <div>
                  <span className="text-sm font-medium">
                    {new Date(b.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '} à {b.time}
                  </span>
                  <span className="text-xs text-ink-muted ml-2">Court {b.court_id}</span>
                  {b.note && <span className="text-xs text-ink-muted ml-2">· {b.note}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <a className="btn btn-soft px-2 py-1 text-xs" href={bookingICSUrl(b.id)} title="Ajouter au calendrier">.ics</a>
                  <button type="button" className="btn btn-outline px-2 py-1 text-xs"
                          onClick={() => setToCancel(b)}>Annuler</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Historique</h4>
          <ul className="space-y-1">
            {past.slice(0, 10).map(b => (
              <li key={b.id} className="flex items-center justify-between text-sm text-ink-muted px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <span>
                  {new Date(b.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '} à {b.time} — Court {b.court_id}
                </span>
                <a className="btn btn-soft px-2 py-1 text-xs" href={bookingICSUrl(b.id)}>.ics</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
