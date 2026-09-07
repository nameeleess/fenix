import {
  useEffect,
  useState,
} from 'react'

import {
  getCurrentLocalDateKey,
  millisecondsUntilNextLocalDay,
} from './freshnessPolicy'

import {
  subscribeToCommittedMutations,
} from './freshnessEvents'

export interface AppFreshnessState {
  dateKey: string
  revision: number
}

export function useAppFreshness(): AppFreshnessState {
  const [state, setState] = useState<AppFreshnessState>(() => ({
    dateKey: getCurrentLocalDateKey(),
    revision: 0,
  }))

  useEffect(() => {
    let rolloverTimer: number | null = null
    let lastEnvironmentRefreshAt = Date.now()

    function publishRefresh() {
      setState((current) => ({
        dateKey: getCurrentLocalDateKey(),
        revision: current.revision + 1,
      }))
    }

    function requestEnvironmentRefresh() {
      if (document.visibilityState === 'hidden') {
        return
      }

      const now = Date.now()

      // iOS/desktop browsers can emit visibilitychange and focus together.
      // Coalesce that pair so active modules do not issue duplicate refreshes.
      if (now - lastEnvironmentRefreshAt < 250) {
        return
      }

      lastEnvironmentRefreshAt = now
      publishRefresh()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        requestEnvironmentRefresh()
      }
    }

    function scheduleRollover() {
      if (rolloverTimer !== null) {
        window.clearTimeout(rolloverTimer)
      }

      rolloverTimer = window.setTimeout(() => {
        publishRefresh()
        scheduleRollover()
      }, millisecondsUntilNextLocalDay())
    }

    const unsubscribeCommittedMutations =
      subscribeToCommittedMutations(() => {
        publishRefresh()
      })

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )
    window.addEventListener(
      'focus',
      requestEnvironmentRefresh,
    )
    scheduleRollover()

    return () => {
      unsubscribeCommittedMutations()

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
      window.removeEventListener(
        'focus',
        requestEnvironmentRefresh,
      )

      if (rolloverTimer !== null) {
        window.clearTimeout(rolloverTimer)
      }
    }
  }, [])

  return state
}
