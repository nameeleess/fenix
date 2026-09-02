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

import {
  ensureTodaySeed,
} from './features/today/todaySeed'

import TrainingPage from './features/training/TrainingPage'

import NutritionPage from './features/nutrition/NutritionPage'

import './styles/app.css'

type AppState =
  | 'checking'
  | 'ready'
  | 'error'

type AppSection =
  | 'training'
  | 'nutrition'

function App() {
  const [
    appState,
    setAppState,
  ] =
    useState<AppState>(
      'checking',
    )

  const [
    section,
    setSection,
  ] =
    useState<AppSection>(
      'training',
    )

  useEffect(() => {
    let active = true

    async function initializeApp() {
      await initializeDatabase()

      await ensureTrainingSeed()

      await ensureNutritionSeed()

      await ensureTodaySeed()
    }

    initializeApp()
      .then(() => {
        if (active) {
          setAppState(
            'ready',
          )
        }
      })
      .catch(
        (error: unknown) => {
          console.error(
            'Error inicializando FÉNIX:',
            error,
          )

          if (active) {
            setAppState(
              'error',
            )
          }
        },
      )

    return () => {
      active = false
    }
  }, [])

  if (
    appState === 'checking'
  ) {
    return (
      <main>
        <p>
          Preparando FÉNIX…
        </p>
      </main>
    )
  }

  if (
    appState === 'error'
  ) {
    return (
      <main>
        <h1>
          FÉNIX
        </h1>

        <p>
          No se ha podido iniciar
          la base local. Tus datos
          existentes no han sido
          borrados.
        </p>
      </main>
    )
  }

  return (
    <div className="fenix-app">
      <div
        className="fenix-view"
        hidden={
          section !==
          'training'
        }
      >
        <TrainingPage />
      </div>

      <div
        className="fenix-view"
        hidden={
          section !==
          'nutrition'
        }
      >
        <NutritionPage />
      </div>

      <nav
        className="fenix-navigation"
        aria-label="Navegación principal"
      >
        <div className="fenix-navigation__inner">
          <button
            type="button"
            className={
              section ===
              'training'
                ? 'active'
                : ''
            }
            onClick={() =>
              setSection(
                'training',
              )
            }
          >
            Training
          </button>

          <button
            type="button"
            className={
              section ===
              'nutrition'
                ? 'active'
                : ''
            }
            onClick={() =>
              setSection(
                'nutrition',
              )
            }
          >
            Nutrition
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App