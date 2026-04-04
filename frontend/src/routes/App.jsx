import React, { useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import Banner from '../components/Banner'
import { useBanner } from '../hooks/useBanner'

export default function App() {
  const { user, loading, logout } = useAuth()
  const [authOpen, setAuthOpen]   = useState(false)
  const [dark, setDark]           = useState(() => localStorage.getItem('theme-dark') === '1')
  const { banner, setBanner, clearBanner } = useBanner()
  const loc      = useLocation()
  const navigate = useNavigate()

  const club    = import.meta.env.VITE_CLUB_NAME || 'M Squash'
  const tagline = import.meta.env.VITE_TAGLINE   || 'Club • Food • Sports'
  const brand   = import.meta.env.VITE_PRIMARY   || '#0a6bdc'

  useEffect(() => { document.documentElement.style.setProperty('--brand-dynamic', brand) }, [brand])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  function toggleDark() {
    const v = !dark; setDark(v); localStorage.setItem('theme-dark', v ? '1' : '0')
  }

  function handleLogout() {
    logout()
    setBanner('success', 'Déconnecté.')
    navigate('/')
  }

  // Allow child components to open auth modal via custom event
  useEffect(() => {
    const handler = () => setAuthOpen(true)
    window.addEventListener('open-auth', handler)
    return () => window.removeEventListener('open-auth', handler)
  }, [])

  const navLink = (path, label) => (
    <Link to={path}
          className={`btn text-sm ${loc.pathname === path || (path !== '/' && loc.pathname.startsWith(path)) ? 'btn-primary' : 'btn-outline'}`}>
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen brand-gradient">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-gray-200/70 header-glass">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/club-logo.png" alt="Club logo"
                 className="h-10 w-10 rounded-full border border-white/60 shadow object-cover" />
            <div className="leading-tight">
              <div className="text-base font-semibold">{club}</div>
              <div className="text-xs text-ink-muted">{tagline}</div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1.5 flex-wrap justify-end">
            {navLink('/', 'Accueil')}
            {navLink('/booking', 'Réserver')}

            {!loading && (
              user ? (
                <>
                  <Link to="/profile"
                        className={`btn text-sm ${loc.pathname.startsWith('/profile') ? 'btn-primary' : 'btn-outline'}`}>
                    {user.name.split(' ')[0]}
                  </Link>
                  {user.role === 'ADMIN' && navLink('/admin', 'Admin')}
                  <button type="button" className="btn btn-outline text-sm" onClick={handleLogout}>
                    Déconnexion
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary text-sm" onClick={() => setAuthOpen(true)}>
                  Connexion
                </button>
              )
            )}

            <button type="button" className="btn btn-outline text-sm" onClick={toggleDark}
                    title={dark ? 'Mode clair' : 'Mode sombre'}>
              {dark ? '☀️' : '🌙'}
            </button>
          </nav>
        </div>

        {banner && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <Banner banner={banner} onClose={clearBanner} />
          </div>
        )}
      </header>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setBanner('success', 'Connecté avec succès.')}
      />

      <Outlet context={{ setBanner, setAuthOpen }} />

      <footer className="text-xs text-ink-muted text-center py-8 border-t border-gray-100 mt-8">
        © {new Date().getFullYear()} {club} — Plateforme de réservation
      </footer>
    </div>
  )
}
