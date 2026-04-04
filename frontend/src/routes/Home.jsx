import React from 'react'
import { Link } from 'react-router-dom'

export default function Home(){
  const club = import.meta.env.VITE_CLUB_NAME || 'M Squash'
  const tagline = import.meta.env.VITE_TAGLINE || 'Club • Food • Sports'
  return <main className="max-w-7xl mx-auto px-4 pt-12 pb-8">
    <section className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white border shadow-sm">Nouveau • Plateforme de réservation</div>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">{club}</h1>
        <p className="text-ink-muted mt-2">{tagline}</p>
        <ul className="mt-4 text-sm text-ink-muted list-disc pl-5 space-y-1">
          <li>Réservations en <b>quelques clics</b></li>
          <li>Gestion <b>admins</b> : blocages, exports CSV</li>
          <li>Comptes membres, limites et fenêtre de réservation</li>
          <li>Ajout au calendrier (.ics)</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <Link to="/booking" className="btn btn-primary">Réserver un créneau</Link>
          <button type="button" className="btn btn-outline" onClick={()=> document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}>Découvrir</button>
        </div>
      </div>
      <div className="relative">
        <img src="/club-logo.png" alt="Logo" className="w-48 h-48 mx-auto rounded-full border shadow-md bg-white p-3" />
      </div>
    </section>

    <section id="features" className="grid md:grid-cols-3 gap-4 mt-12">
      {[
        ['Réservations', 'Vue courts × créneaux, rapide et claire.'],
        ['Comptes & rôles', 'Users & Admins avec règles du club.'],
        ['Exports', 'CSV + .ics pour calendrier.'],
      ].map(([t,d])=> <div key={t} className="card"><div className="card-body"><h3 className="font-semibold">{t}</h3><p className="text-sm text-ink-muted mt-1">{d}</p></div></div>)}
    </section>
  </main>
}
