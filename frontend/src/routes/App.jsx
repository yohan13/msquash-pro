import React, { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'

export default function App(){
  const brand = import.meta.env.VITE_PRIMARY || '#0a6bdc'
  useEffect(()=>{ document.documentElement.style.setProperty('--brand-dynamic', brand) },[brand])
  const club = import.meta.env.VITE_CLUB_NAME || 'M Squash'
  const tagline = import.meta.env.VITE_TAGLINE || 'Club • Food • Sports'

  const loc = useLocation()
  const [dark, setDark] = React.useState(false)
  useEffect(()=>{
    const saved = localStorage.getItem('theme-dark') === '1'
    setDark(saved); document.documentElement.classList.toggle('dark', saved)
  },[])
  function toggleDark(){
    const v = !dark; setDark(v); localStorage.setItem('theme-dark', v ? '1' : '0')
    document.documentElement.classList.toggle('dark', v)
  }

  // Auth header-only
  const [authMode,setAuthMode]=React.useState('login')
  const [form,setForm]=React.useState({name:'',email:'',password:''})
  const [banner,setBanner]=React.useState(null)
  async function handleAuth(e){
    e.preventDefault()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try{
      let r,j
      if(authMode==='register'){
        r = await fetch(`${API_URL}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); j=await r.json()
      }else{
        r = await fetch(`${API_URL}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email,password:form.password})}); j=await r.json()
      }
      if(!r.ok) throw new Error(j.error||'auth_failed')
      localStorage.setItem('token', j.token)
      setForm({name:'',email:'',password:''})
      window.dispatchEvent(new Event('auth-changed'))
      setBanner({type:'success', text:'Connecté.'})
      setTimeout(()=> setBanner(null), 2500)
    }catch(err){
      setBanner({type:'error', text: err.message})
    }
  }
  function logout(){ localStorage.removeItem('token'); window.dispatchEvent(new Event('auth-changed')); setBanner({type:'success', text:'Déconnecté.'}); setTimeout(()=> setBanner(null), 2000) }

  return <div className="min-h-screen brand-gradient">
    <div className="sticky top-0 z-30 border-b border-gray-200/70 header-glass">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <img src="/club-logo.png" alt="Club logo" className="h-10 w-10 rounded-full border border-white/60 shadow" />
          <div className="leading-tight">
            <div className="text-base font-semibold">{club}</div>
            <div className="text-xs text-ink-muted">{tagline}</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/" className={`btn ${loc.pathname==='/'?'btn-primary':'btn-outline'}`}>Accueil</Link>
          <Link to="/booking" className={`btn ${loc.pathname.startsWith('/booking')?'btn-primary':'btn-outline'}`}>Réserver</Link>
          <button type="button" className="btn btn-outline" onClick={toggleDark}>{dark?'☀️ Clair':'🌙 Sombre'}</button>
        </nav>
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-3">
        {banner && <div className={`mb-2 rounded-lg px-3 py-2 text-sm ${banner.type==='error'?'bg-red-50 text-red-700 border border-red-200':'bg-green-50 text-green-700 border border-green-200'}`}>{banner.text}</div>}
        <div className="toolbar">
          <select className="field w-36" value={authMode} onChange={e=> setAuthMode(e.target.value)}>
            <option value="login">Connexion</option>
            <option value="register">Inscription</option>
          </select>
          <form onSubmit={handleAuth} className="flex flex-wrap items-center gap-2">
            {authMode==='register' && <input className="field" placeholder="Nom" value={form.name} onChange={e=> setForm({...form,name:e.target.value})} />}
            <input id="auth-email" className="field" placeholder="Email" value={form.email} onChange={e=> setForm({...form,email:e.target.value})} />
            <input id="auth-password" type="password" className="field" placeholder="Mot de passe" value={form.password} onChange={e=> setForm({...form,password:e.target.value})} />
            <button type="submit" className="btn btn-primary">{authMode==='register'?'Créer le compte':'Se connecter'}</button>
            <button type="button" className="btn btn-outline" onClick={logout}>Se déconnecter</button>
          </form>
        </div>
      </div>
    </div>
    <Outlet />
    <footer className="text-xs text-ink-muted text-center py-8">© {new Date().getFullYear()} {club} — Plateforme</footer>
  </div>
}
