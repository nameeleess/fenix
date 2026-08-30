import {
  useEffect,
  useState,
} from 'react'

import {
  initializeDatabase,
} from './db/database'

import {
  ensureTrainingSeed,
} from './features/training/trainingSeed'

import {
  ensureNutritionSeed,
} from './features/nutrition/nutritionSeed'

import TrainingPage from './features/training/TrainingPage'

type AppState =
  | 'checking'
  | 'ready'
  | 'error'

function App() {
  const [appState, setAppState] =
    useState<AppState>('checking')

  useEffect(() => {
    let active = true

    async function initializeApp() {
      await initializeDatabase()
      await ensureTrainingSeed()
      await ensureNutritionSeed()
    }

    initializeApp()
      .then(() => {
        if (active) {
          setAppState('ready')
        }
      })
      .catch((error: unknown) => {
        console.error(
          'Error inicializando FÉNIX:',
          error,
        )

        if (active) {
          setAppState('error')
        }
      })

    return () => {
      active = false
    }
  }, [])

  if (appState === 'checking') {
    return (
      <main>
        <p>
          Preparando FÉNIX…
        </p>
      </main>
    )
  }

  if (appState === 'error') {
    return (
      <main>
        <h1>
          FÉNIX
        </h1>

        <p>
          No se ha podido iniciar la base local.
          Tus datos existentes no han sido borrados.
        </p>
      </main>
    )
  }

  return <TrainingPage />
}

export default App