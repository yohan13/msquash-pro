import React, { useEffect } from 'react'

export default function Modal({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirmer', danger = false }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel?.() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
         onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
           onClick={e => e.stopPropagation()}>
        {title && <h3 className="font-semibold text-base mb-2">{title}</h3>}
        {message && <p className="text-sm text-ink-muted mb-5">{message}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-outline" onClick={onCancel}>Annuler</button>
          <button type="button"
                  className={`btn ${danger ? 'border-transparent text-white bg-red-600 hover:bg-red-700' : 'btn-primary'}`}
                  onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
