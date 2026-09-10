import { useEffect } from 'react'
import { db } from '../db/database'
import { getLocalDateKey } from '../utils/date'

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export function useAppBadge(refreshRevision: number) {
  useEffect(() => {
    let cancelled = false
    const nav = navigator as NavigatorWithBadge
    if (!nav.setAppBadge) return

    void (async () => {
      const today = getLocalDateKey()
      const [tasks, training, meals] = await Promise.all([
        db.dailyRoutineTasks.where('date').equals(today).toArray(),
        db.plannedWorkoutSessions.where('scheduledDate').equals(today).toArray(),
        db.dailyMeals.where('date').equals(today).toArray(),
      ])
      if (cancelled) return
      const pending =
        tasks.filter((item) => item.deletedAt === null && item.status === 'pending').length +
        training.filter((item) => item.deletedAt === null && (item.status === 'pending' || item.status === 'in_progress')).length +
        meals.filter((item) => item.deletedAt === null && item.status === 'pending').length
      if (pending > 0) await nav.setAppBadge?.(pending)
      else await nav.clearAppBadge?.()
    })().catch(() => undefined)

    return () => { cancelled = true }
  }, [refreshRevision])
}
