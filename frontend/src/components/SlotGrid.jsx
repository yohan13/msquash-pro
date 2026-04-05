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

// Retourne le prénom uniquement si le nom est trop long
function firstName(name) {
  if (!name) return ''
  const parts = name.trim().split(' ')
  return parts[0]
}

export default function SlotGrid({ cfg, date, dayData, user, note, reason, onReserve, onCancel, onToggleBlock, loading }) {
  const [confirmCancel, setConfirmCancel] = useState(null)

  const slots    = genSlots(cfg.dayStart, cfg.dayEnd, cfg.slotMinutes)
  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday  = date === todayStr
  const nowHHMM  = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
  const isAdmin  = user?.role === 'ADMIN'

  // Compact mode au-delà de 6 courts
  const compact = cfg.courts.length > 6
  const colMinW = compact ? 80 : 110
  const timeColW = compact ? 52 : 80

  function findBooking(courtId, time) { return dayData.bookings.find(b => b.court_id === courtId && b.time === time) }
  function findBlock(courtId, time)   { return dayData.blocks.find(b => b.court_id === courtId && b.time === time) }

  return (
    <>
      <Modal
        open={!!confirmCancel}
        title="Annuler la réservation ?"
        message={confirmCancel
          ? `${confirmCancel.date} à ${confirmCancel.time} — Court ${confirmCancel.court_id}${confirmCancel.booked_for_name ? ` (${confirmCancel.booked_for_name})` : confirmCancel.user_name ? ` (${confirmCancel.user_name})` : ''}`
          : ''}
        confirmLabel="Oui, annuler"
        danger
        onConfirm={() => { onCancel(confirmCancel); setConfirmCancel(null) }}
        onCancel={() => setConfirmCancel(null)}
      />

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${timeColW + cfg.courts.length * colMinW}px` }}>
          <div className="grid" style={{
            gridTemplateColumns: `${timeColW}px repeat(${cfg.courts.length}, minmax(${colMinW}px, 1fr))`,
            gridTemplateRows:    `auto repeat(${slots.length}, ${compact ? '48px' : '52px'})`
          }}>
            {/* Header */}
            <div className="grid-time border-b border-r font-semibold text-xs text-ink-muted"
                 style={{ background: 'var(--panel-alt)' }}>Heure</div>
            {cfg.courts.map(c => (
              <div key={c.id} className="grid-head text-xs">{c.name}</div>
            ))}

            {/* Slots */}
            {slots.map(t => {
              const isDatePast = date < todayStr
              const isPastSlot = isDatePast || (isToday && timeLess(t, nowHHMM))

              return (
                <React.Fragment key={t}>
                  <div className="grid-time text-xs">
                    <span className="font-medium">{t}</span>
                    {isPastSlot && !isDatePast && (
                      <span className="text-[9px] block text-ink-muted/70 leading-tight">passé</span>
                    )}
                  </div>

                  {cfg.courts.map(c => {
                    const b     = findBooking(c.id, t)
                    const bl    = findBlock(c.id, t)
                    const owned = user && b && b.user_id === user.id

                    let cellClass = 'border border-gray-100 '
                    if (bl)             cellClass += 'bg-gray-100'
                    else if (owned)     cellClass += 'bg-brand/8'
                    else if (b)         cellClass += 'bg-green-50'
                    else if (isPastSlot) cellClass += 'bg-gray-50'
                    else                cellClass += 'bg-white hover:bg-blue-50/40 transition-colors'

                    // Nom à afficher (admin : nom complet ou invité ; membre : "✓ Moi")
                    const displayName = b?.booked_for_name || b?.user_name || ''
                    const player2Label = b?.player2_member_name || b?.player2_name || ''
                    const tooltipFull  = [
                      displayName,
                      player2Label ? `vs ${player2Label}` : '',
                      b?.note || '',
                    ].filter(Boolean).join(' · ')

                    return (
                      <div key={`${t}-${c.id}`} className={`relative ${cellClass}`}>
                        <div className="absolute inset-0 flex items-center justify-center p-0.5">
                          {bl ? (
                            /* ── Bloqué ── */
                            <div className="flex flex-col items-center text-center w-full px-0.5">
                              <span className="text-[9px] font-semibold text-gray-500 leading-tight truncate w-full text-center"
                                    title={bl.reason || 'Bloqué'}>
                                {compact ? '🔒' : (bl.reason || 'Bloqué')}
                              </span>
                              {isAdmin && onToggleBlock && (
                                <button type="button"
                                        className="btn btn-outline px-1 py-0 text-[9px] mt-0.5 leading-tight"
                                        onClick={() => onToggleBlock(c.id, t)}>
                                  {compact ? '🔓' : 'Débloquer'}
                                </button>
                              )}
                            </div>

                          ) : b ? (
                            /* ── Réservé ── */
                            <div className="flex flex-col items-center text-center w-full px-0.5 gap-0.5">
                              {owned ? (
                                <span className="text-[10px] font-semibold truncate w-full text-center text-brand"
                                      title={tooltipFull}>
                                  ✓ Moi{player2Label && !compact ? ` · ${firstName(player2Label)}` : ''}
                                </span>
                              ) : isAdmin ? (
                                <span className="text-[10px] font-semibold truncate w-full text-center"
                                      title={tooltipFull}>
                                  {b.booked_for_name
                                    ? `${firstName(b.booked_for_name)} ★`
                                    : firstName(displayName)}
                                  {player2Label && !compact ? ` · ${firstName(player2Label)}` : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] text-ink-muted">Réservé</span>
                              )}

                              {/* Boutons action */}
                              {(owned || isAdmin) && (
                                <div className="flex items-center gap-0.5">
                                  <button type="button"
                                          className="btn btn-outline px-1 py-0 text-[9px] leading-tight"
                                          onClick={() => setConfirmCancel(b)}>
                                    ✕
                                  </button>
                                  {!compact && (
                                    <a className="btn btn-soft px-1 py-0 text-[9px] leading-tight"
                                       href={bookingICSUrl(b.id)} title="Ajouter au calendrier">.ics</a>
                                  )}
                                </div>
                              )}
                            </div>

                          ) : (
                            /* ── Libre ── */
                            !isPastSlot && (
                              <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                                <button type="button"
                                        className={`btn btn-primary leading-tight w-full ${compact ? 'px-0 py-0 text-[9px]' : 'px-1 py-0.5 text-[10px]'}`}
                                        disabled={loading}
                                        onClick={() => onReserve(c.id, t)}>
                                  {user ? (compact ? '+' : 'Réserver') : 'Connexion'}
                                </button>
                                {isAdmin && onToggleBlock && !compact && (
                                  <button type="button"
                                          className="btn btn-outline px-1 py-0 text-[9px] leading-tight"
                                          onClick={() => onToggleBlock(c.id, t)}>
                                    🚫
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
