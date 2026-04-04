import React, { useEffect, useMemo, useState } from 'react'
import { getConfig, getDay, createBooking, deleteBooking, createBlock, deleteBlock, me, myBookings, exportCSV, bookingICSUrl } from '../api'

function pad(n){ return n<10?`0${n}`:`${n}` }
function toISODate(d){ return d.toISOString().slice(0,10) }
function addMinutes(hhmm, mins){ const [h,m]=hhmm.split(':').map(Number); const d=new Date(); d.setHours(h,m+mins,0,0); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function timeLess(a,b){ if(a===b) return false; const [ah,am]=a.split(':').map(Number); const [bh,bm]=b.split(':').map(Number); return ah<bh || (ah===bh && am<bm) }
function genSlots(start,end,step){ const out=[]; let cur=start; while(timeLess(cur,end)){ out.push(cur); cur = addMinutes(cur, step) } return out }

export default function Book(){
  const [cfg,setCfg]=useState(null)
  const [date,setDate]=useState(()=>toISODate(new Date()))
  const [dayData,setDayData]=useState({bookings:[],blocks:[]})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)

  const [user,setUser]=useState(null)
  const [note,setNote]=useState('')
  const [reason,setReason]=useState('')

  const [banner,setBanner]=useState(null)

  useEffect(()=>{
    getConfig().then(setCfg).catch(e=> setError(e.message))
    const loadUser = async () => { try{ const r = await me(); setUser(r.user) }catch{} }
    loadUser()
    const fn = () => loadUser()
    window.addEventListener('auth-changed', fn)
    return () => window.removeEventListener('auth-changed', fn)
  },[])

  useEffect(()=>{ if(!cfg) return; setLoading(true); getDay(date).then(setDayData).finally(()=> setLoading(false)) },[cfg,date])

  const slots = useMemo(()=> cfg ? genSlots(cfg.dayStart,cfg.dayEnd,cfg.slotMinutes) : [], [cfg])
  const isToday = date === toISODate(new Date())
  const nowHHMM = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
  const isAdmin = user?.role === 'ADMIN'

  function findBooking(courtId,time){ return dayData.bookings.find(b=>b.court_id===courtId && b.time===time) }
  function findBlock(courtId,time){ return dayData.blocks.find(b=>b.court_id===courtId && b.time===time) }

  async function doReserve(courtId,time){
    if(!user){
      try{ const email = document.getElementById('auth-email'); window.scrollTo({top:0, behavior:'smooth'}); setTimeout(()=> email?.focus(), 200) }catch{}
      setBanner({type:'info',text:'Connecte-toi pour réserver.'}); setTimeout(()=> setBanner(null), 2000); return;
    }
    try{ await createBooking({ date,time,courtId,note:note.trim()||null }); const fresh=await getDay(date); setDayData(fresh); setBanner({type:'success',text:'Réservé.'}); setTimeout(()=> setBanner(null), 1500) } catch(e){ setBanner({type:'error', text:e.message}); }
  }
  async function doCancel(b){
    try{ await deleteBooking(b.id); const fresh=await getDay(date); setDayData(fresh); setBanner({type:'success',text:'Réservation annulée.'}); setTimeout(()=> setBanner(null), 1500) } catch(e){ setBanner({type:'error', text:e.message}); }
  }
  async function toggleBlock(courtId,time){
    if(!isAdmin){ setBanner({type:'error', text:'Réservé aux admins.'}); setTimeout(()=> setBanner(null), 1500); return; }
    const blk = findBlock(courtId,time)
    try{
      if(blk) await deleteBlock(blk.id)
      else await createBlock({date,time,courtId,reason:reason.trim()||null})
      const fresh=await getDay(date); setDayData(fresh); setBanner({type:'success', text: blk ? 'Débloqué.' : 'Bloqué.'}); setTimeout(()=> setBanner(null), 1200)
    }catch(e){ setBanner({type:'error', text:e.message}); }
  }

  const [mine,setMine]=useState([])
  useEffect(()=>{ if(user) myBookings().then(r=> setMine(r.bookings||[])) },[user,dayData])

  const [from,setFrom]=useState(()=>toISODate(new Date()))
  const [to,setTo]=useState(()=>toISODate(new Date(Date.now()+7*86400000)))
  async function doExport(){
    try{
      const blob = await exportCSV(from,to)
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`export_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url)
      setBanner({type:'success', text:'Export CSV prêt.'}); setTimeout(()=> setBanner(null), 1500)
    }catch(e){ setBanner({type:'error', text:e.message}); }
  }

  if(error) return <div className="max-w-7xl mx-auto p-4 text-red-700">Erreur: {error}</div>
  if(!cfg) return <div className="max-w-7xl mx-auto p-4">Chargement…</div>

  // ---- Fixed row heights: 56px per slot ----
  const gridRows = `auto repeat(${slots.length}, 56px)`

  return <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
    {banner && <div className={`rounded-lg px-3 py-2 text-sm ${banner.type==='error'?'bg-red-50 text-red-700 border border-red-200': banner.type==='success'?'bg-green-50 text-green-700 border border-green-200':'bg-blue-50 text-blue-700 border border-blue-200'}`}>{banner.text}</div>}

    <section className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="font-semibold">Réservations {new Date(date).toLocaleDateString()}</h2>
        <div className="text-sm text-ink-muted">Créneaux: {cfg.dayStart} → {cfg.dayEnd} • {cfg.slotMinutes} min • Courts: {cfg.courts.length}</div>
      </div>
      <div className="card-body grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm block mb-1">Note (ajoutée à la réservation)</label>
          <input className="field" placeholder="Ex: jeu classé, duo avec Alex…" value={note} onChange={e=> setNote(e.target.value)} />
        </div>
        <div>
          <label className="text-sm block mb-1">Raison de blocage (admin)</label>
          <input className="field" placeholder="Ex: Tournoi interne" value={reason} onChange={e=> setReason(e.target.value)} />
        </div>
        <div className="md:col-span-2 text-sm text-ink-muted">
          Règles: max <b>{cfg.rules.MAX_FUTURE_BOOKINGS}</b> résa à venir • fenêtre <b>{cfg.rules.MAX_DAYS_AHEAD}</b> jours • {cfg.rules.UNIQUE_PER_TIMESLOT? '1 créneau par horaire/membre':'plusieurs créneaux autorisés'}.
        </div>
      </div>
    </section>

    <section className="card overflow-x-auto">
      <div className="card-header flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-semibold">Grille des créneaux</h3>
        <div className="toolbar">
          <input className="field w-40" type="date" value={date} onChange={e=> setDate(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={()=> setDate(toISODate(new Date(Date.parse(date) - 86400000)))}>◀ Jour</button>
          <button type="button" className="btn btn-outline" onClick={()=> setDate(toISODate(new Date(Date.parse(date) + 86400000)))}>Jour ▶</button>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="min-w-[900px]">
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${cfg.courts.length}, 1fr)`, gridTemplateRows: gridRows }}>
            {/* header row */}
            <div></div>
            {cfg.courts.map(c => <div key={c.id} className="grid-head">{c.name}</div>)}

            {/* timeslots rows */}
            {slots.map(t => (
              <React.Fragment key={t}>
                <div className="grid-time">
                  <span>{t}</span>
                  {isToday && t <= nowHHMM && <span className="text-[10px] text-ink-muted">passé</span>}
                </div>
                {cfg.courts.map(c => {
                  const b = findBooking(c.id, t)
                  const bl = findBlock(c.id, t)
                  const isPast = isToday && t <= nowHHMM
                  const owned = user && b && b.user_id === user.id

                  return <div key={`${t}-${c.id}`} className={`border ${bl ? 'bg-gray-200' : b ? owned ? 'bg-blue-50' : 'bg-green-50' : isPast ? 'bg-gray-50' : 'bg-white'}`} style={{position:'relative'}}>
                    <div style={{position:'absolute', inset:0}} className="flex items-center justify-center gap-1">
                      {bl ? (
                        <>
                          <span className="text-[11px] font-semibold">Bloqué</span>
                          {isAdmin && <button type="button" className="btn btn-outline px-2 py-1 text-xs" onClick={()=> toggleBlock(c.id, t)}>Débloquer</button>}
                        </>
                      ) : b ? (
                        <>
                          <span className="text-[12px] font-semibold truncate max-w-[120px]" title={b.user_name}>{b.user_name}</span>
                          {(owned || isAdmin) && <button type="button" className="btn btn-outline px-2 py-1 text-xs bg-white" onClick={()=> doCancel(b)}>Annuler</button>}
                          <a className="btn btn-soft px-2 py-1 text-xs" href={bookingICSUrl(b.id)}>.ics</a>
                          {isAdmin && <button type="button" className="btn btn-soft px-2 py-1 text-xs" onClick={()=> toggleBlock(c.id, t)}>Bloquer</button>}
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" disabled={isPast} onClick={()=> doReserve(c.id, t)}>{user? 'Réserver':'Se connecter'}</button>
                          {isAdmin && <button type="button" className="btn btn-outline px-2 py-1 text-xs" onClick={()=> toggleBlock(c.id, t)}>Bloquer</button>}
                        </>
                      )}
                    </div>
                  </div>
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="card">
      <div className="card-header flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Mes réservations</h3>
        {isAdmin && <div className="toolbar">
          <input className="field w-36" type="date" value={from} onChange={e=> setFrom(e.target.value)} />
          <span className="text-sm text-ink-muted">→</span>
          <input className="field w-36" type="date" value={to} onChange={e=> setTo(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={doExport}>Exporter CSV</button>
        </div>}
      </div>
      <div className="card-body">
        {!user ? <div className="text-sm text-ink-muted">Connecte-toi pour voir tes réservations.</div> : (
          mine.length===0 ? <div className="text-sm text-ink-muted">Aucune réservation à venir.</div> :
            <ul className="text-sm grid md:grid-cols-2 gap-2">
              {mine.map(m => <li key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <span>{m.date} {m.time} • court {m.court_id}</span>
                <div className="flex items-center gap-2">
                  <a className="btn btn-soft px-2 py-1 text-xs" href={bookingICSUrl(m.id)}>.ics</a>
                  <button type="button" className="btn btn-outline px-2 py-1 text-xs" onClick={()=> doCancel(m)}>Annuler</button>
                </div>
              </li>)}
            </ul>
        )}
      </div>
    </section>
  </main>
}
