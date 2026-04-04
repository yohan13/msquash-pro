import { useState, useCallback, useRef } from 'react'

export function useBanner() {
  const [banner, setBannerState] = useState(null)
  const timerRef = useRef(null)

  const setBanner = useCallback((type, text, duration = null) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setBannerState({ type, text })
    const delay = duration ?? (type === 'error' ? 5000 : 2500)
    timerRef.current = setTimeout(() => setBannerState(null), delay)
  }, [])

  const clearBanner = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setBannerState(null)
  }, [])

  return { banner, setBanner, clearBanner }
}
