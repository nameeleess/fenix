import { db } from '../db/database'

type UpdateHandler = (reloadPage?: boolean) => Promise<void>

let applyUpdate: UpdateHandler | null = null
let updateWaiting = false

export function setPwaUpdateHandler(handler: UpdateHandler) {
  applyUpdate = handler
}

export function signalPwaUpdateAvailable() {
  updateWaiting = true
  window.dispatchEvent(new CustomEvent('fenix:pwa-update-available'))
}

export function isPwaUpdateWaiting() {
  return updateWaiting
}

export async function hasActiveWorkoutSession() {
  const sessions = await db.workoutSessions.where('status').equals('active').toArray()
  return sessions.some((session) => session.deletedAt === null)
}

export async function applyPwaUpdateWhenSafe() {
  if (!applyUpdate) return { applied: false, deferred: false }
  const active = await hasActiveWorkoutSession()
  if (active) return { applied: false, deferred: true }
  await applyUpdate(true)
  updateWaiting = false
  return { applied: true, deferred: false }
}
