import { useEffect, useState } from 'react'
import { applyPwaUpdateWhenSafe, hasActiveWorkoutSession, isPwaUpdateWaiting } from '../app/pwaUpdates'

export function usePwaUpdateState(refreshRevision: number) {
  const [visible, setVisible] = useState(isPwaUpdateWaiting())
  const [deferred, setDeferred] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('fenix:pwa-update-available', handler)
    return () => window.removeEventListener('fenix:pwa-update-available', handler)
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void hasActiveWorkoutSession().then((active) => {
      if (!cancelled) setDeferred(active)
    })
    return () => { cancelled = true }
  }, [refreshRevision, visible])

  async function apply() {
    const result = await applyPwaUpdateWhenSafe()
    setDeferred(result.deferred)
    if (result.applied) setVisible(false)
  }

  return { visible, deferred, apply }
}
