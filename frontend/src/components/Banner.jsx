import React from 'react'

const styles = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error:   'bg-red-50 text-red-800 border-red-200',
  info:    'bg-blue-50 text-blue-800 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
}

export default function Banner({ banner, onClose }) {
  if (!banner) return null
  return (
    <div className={`flex items-start justify-between gap-2 rounded-xl px-4 py-3 text-sm border ${styles[banner.type] || styles.info}`}
         role="alert">
      <span>{banner.text}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100 text-lg leading-none mt-[-1px]">×</button>
      )}
    </div>
  )
}
