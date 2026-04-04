import React, { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { getConfig } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user }          = useAuth()
  const { setAuthOpen }   = useOutletContext() || {}
  const [cfg, setCfg]     = useState(null)
  const club    = import.meta.env.VITE_CLUB_NAME || 'M Squash'
  const tagline = import.meta.env.VITE_TAGLINE   || 'Club • Food • Sports'

  useEffect(() => { getConfig().then(setCfg).catch(() => {}) }, [])

  return (
    <main className="max-w-7xl mx-auto px-4 pt-10 pb-12">

      {/* Hero */}
      <section className="grid md:grid-cols-2 gap-10 items-center mb-14">
        <div>
          <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white border shadow-sm text-ink-muted">
            🎾 Réservez vos courts en ligne
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-2">{club}</h1>
          <p className="text-ink-muted text-lg">{tagline}</p>

          {cfg && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="chip">{cfg.courts.length} courts</div>
              <div className="chip">{cfg.dayStart} — {cfg.dayEnd}</div>
              <div className="chip">Créneaux {cfg.slotMinutes} min</div>
              <div className="chip">Réservation jusqu'à J+{cfg.rules.MAX_DAYS_AHEAD}</div>
            </div>
          )}

          <div className="mt-7 flex gap-3 flex-wrap">
            <Link to="/booking" className="btn btn-primary text-sm px-5 py-2.5">
              Réserver un créneau →
            </Link>
            {!user && (
              <button type="button" className="btn btn-outline text-sm px-5 py-2.5"
                      onClick={() => setAuthOpen?.(true)}>
                Créer un compte
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <img src="/club-logo.png" alt="Logo du club"
               className="w-52 h-52 rounded-full border-4 border-white shadow-xl object-cover bg-white p-4" />
        </div>
      </section>

      {/* Features */}
      <section id="features">
        <h2 className="text-xl font-bold mb-5">Tout ce dont vous avez besoin</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: '📅', title: 'Réservation simple', desc: 'Visualisez la disponibilité en temps réel et réservez votre créneau en 2 clics.' },
            { icon: '👥', title: 'Comptes membres', desc: 'Gérez votre profil, consultez votre historique et vos réservations à venir.' },
            { icon: '⚙️', title: 'Outils admin', desc: 'Blocages, exports CSV, gestion des membres et statistiques du club.' },
          ].map(f => (
            <div key={f.title} className="card">
              <div className="card-body">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-ink-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Courts grid preview */}
      {cfg && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-5">Nos courts</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cfg.courts.map(c => (
              <Link key={c.id} to="/booking"
                    className="card hover:shadow-md transition-shadow p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-lg">🎾</div>
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-ink-muted">Squash</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
