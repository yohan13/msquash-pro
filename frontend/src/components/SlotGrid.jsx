import React, { useState } from 'react'
import Modal from './Modal'
import { bookingICSUrl } from '../api'

function pad(n) { return n < 10 ? `0${n}` : `${n}` }

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

function timeLess(a, b) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return ah < bh || (ah === bh && am < bm)
}

export function genSlots(start, end, step) {
  const out = []; let cur = start
  while (timeLess(cur, end)) { out.push(cur); cur = addMinutes(cur, step) }
  return out
}

export default function SlotGrid({ cfg, date, dayData, user, note, reason, onReserve, onCancel, onToggleBlock, loading }) {
  const [confirmCancel, setConfirmCancel] = useState(null) // booking obj

  const slots   = genSlots(cfg.dayStart, cfg.dayEnd, cfg.slotMinutes)
  const isToday = date === new Date().toISOString().slice(0, 10)
  const nowHHMM = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
  const isAdmin = user?.role === 'ADMIN'

  function findBooking(courtId, time) { return dayData.bookings.find(b => b.court_id === courtId && b.time === time) }
  function findBlock(courtId, time)   { return dayData.blocks.find(b => b.court_id === courtId && b.time === time) }

  return (
    <>
      <Modal
        open={!!confirmCancel}
        title="Annuler la réservation ?"
        message={confirmCancel ? `${confirmCancel.date} à ${confirmCancel.time} — Court ${confirmCancel.court_id}${confirmCancel.user_name ? ` (${confirmCancel.user_name})` : ''}` : ''}
        confirmLabel="Oui, annuler"
        danger
        onConfirm={() => { onCancel(confirmCancel); setConfirmCancel(null) }}
        onCancel={() => setConfirmCancel(null)}
      />

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid" style={{
            gridTemplateColumns: `80px repeat(${cfg.courts.length}, 1fr)`,
            gridTemplateRows:    `auto repeat(${slots.length}, 52px)`
          }}>
            {/* Header */}
            <div className="grid-time border-b border-r bg-gray-50 font-semibold text-xs text-ink-muted">Heure</div>
            {cfg.courts.map(c => (
              <div key={c.id} className="grid-head text-sm">{c.name}</div>
            ))}

            {/* Slots */}
            {slots.map(t => (
              <React.Fragment key={t}>
                <div className="grid-time text-xs">
                  <span className="font-medium">{t}</span>
                  {isToday && timeLess(t, nowHHMM) && <span className="text-[9px] block text-ink-muted/70 leading-tight">passé</span>}
                </div>

                {cfg.courts.map(c => {
                  const b      = findBooking(c.id, t)
                  const bl     = findBlock(c.id, t)
                  const isPast = isToday && timeLess(t, nowHHMM)
                  const owned  = user && b && b.user_id === user.id

                  let cellClass = 'border border-gray-100 '
                  if (bl)          cellClass += 'bg-gray-100'
                  else if (owned)  cellClass += 'bg-brand/8'
                  else if (b)      cellClass += 'bg-green-50'
                  else if (isPast) cellClass += 'bg-gray-50'
                  else             cellClass += 'bg-white hover:bg-blue-50/40 transition-colors'

                  return (
                    <div key={`${t}-${c.id}`} className={`relative ${cellClass}`}>
                      <div className="absolute inset-0 flex items-center justify-center gap-1 p-1">
                        {bl ? (
                          <div className="flex flex-col items-center text-center">
                            <span className="text-[10px] font-semibold text-gray-500 leading-tight truncate max-w-full px-1">
                              {bl.reason || 'Bloqué'}
                            </span>
                            {isAdmin && (
                              <button type="button" className="btn btn-outline px-1.5 py-0.5 text-[10px] mt-0.5"
                                      onClick={() => onToggleBlock(c.id, t)}>
                                Débloquer
                              </button>
                            )}
                          </div>
                        ) : b ? (
                          <div className="flex flex-col items-center text-center w-full px-1">
                            {owned ? (
                              <>
                                <span className="text-[11px] font-semibold truncate max-w-full">✓ Moi</span>
                                {(b.player2_member_name || b.player2_name) && (
                                  <span className="text-[9px] text-ink-muted truncate max-w-full">
                                    vs {b.player2_member_name || b.player2_name}
                                  </span>
                                )}
                                {b.note && <span className="text-[9px] text-ink-muted truncate max-w-full" title={b.note}>{b.note}</span>}
                              </>
                            ) : isAdmin ? (
                              <>
                                <span className="text-[11px] font-semibold truncate max-w-full"
                                      title={b.booked_for_name || b.user_name}>
                                  {b.booked_for_name
                                    ? <>{b.booked_for_name} <span className="text-[9px] text-ink-muted font-normal">(invité)</span></>
                                    : b.user_name}
                                </span>
                                {(b.player2_member_name || b.player2_name) && (
                                  <span className="text-[9px] text-ink-muted truncate max-w-full">
                                    vs {b.player2_member_name || b.player2_name}
                                  </span>
                                )}
                                {b.note && <span className="text-[9px] text-ink-muted truncate max-w-full" title={b.note}>{b.note}</span>}
                              </>
                            ) : (
                              <span className="text-[11px] text-ink-muted">Réservé</span>
                            )}
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {(owned || isAdmin) && (
                                <button type="button"
                                        className="btn btn-outline px-1.5 py-0.5 text-[10px]"
                                        onClick={() => setConfirmCancel(b)}>
                                  ✕
                                </button>
                              )}
                              {(owned || isAdmin) && (
                                <a className="btn btn-soft px-1.5 py-0.5 text-[10px]"
                                   href={bookingICSUrl(b.id)} title="Ajouter au calendrier">.ics</a>
                              )}
                              {isAdmin && (
                                <button type="button" className="btn btn-outline px-1.5 py-0.5 text-[10px]"
                                        onClick={() => onToggleBlock(c.id, t)}>
                                  🚫
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {!isPast && (
                              <button type="button"
                                      className="btn btn-primary px-2 py-1 text-xs"
                                      disabled={loading}
                                      onClick={() => onReserve(c.id, t)}>
                                {user ? 'Réserver' : 'Connexion'}
                              </button>
                            )}
                            {isAdmin && !isPast && (
                              <button type="button" className="btn btn-outline px-1.5 py-1 text-xs"
                                      onClick={() => onToggleBlock(c.id, t)}>
                                🚫
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
