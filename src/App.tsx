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

import TodayPage from './features/today/TodayPage'

import TrainingPage from './features/training/TrainingPage'

import NutritionPage from './features/nutrition/NutritionPage'

import ProgressPage from './features/progress/ProgressPage'

import {
  ensureProgressSeed,
} from './features/progress/progressSeed'

import {
  ensureVNextDataMigrations,
} from './services/vNextMigrationService'

import './styles/app.css'

import './styles/mobile-density.css'

import './styles/render-parity.css'

import './styles/visual-polish.css'

import './styles/final-v1.css'

type AppState =
  | 'checking'
  | 'ready'
  | 'error'

type AppSection =
  | 'today'
  | 'training'
  | 'nutrition'
  | 'progress'

function NavigationIcon({
  section,
}: {
  section: AppSection
}) {
  if (
    section ===
    'today'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    )
  }

  if (
    section ===
    'training'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8v8" />
        <path d="M18 8v8" />
        <path d="M3.5 10v4" />
        <path d="M20.5 10v4" />
        <path d="M6 12h12" />
      </svg>
    )
  }

  if (
    section ===
    'nutrition'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 3v7" />
        <path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" />
        <path d="M7 10v11" />
        <path d="M16 3c2 1.5 3 4 3 7v11" />
        <path d="M16 3v9h3" />
      </svg>
    )
  }

  return (
    <img
      className="fenix-phoenix-icon"
      src="/fenix-icon-32.png"
      alt=""
      aria-hidden="true"
    />
  )
}

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
      'today',
    )

  useEffect(() => {
    let active = true

    async function initializeApp() {
      await initializeDatabase()

      await ensureTrainingSeed()

      await ensureNutritionSeed()

      await ensureTodaySeed()

      await ensureVNextDataMigrations()

      await ensureProgressSeed()
    }

    initializeApp()
      .then(() => {
        if (
          active
        ) {
          setAppState(
            'ready',
          )
        }
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            'Error inicializando FÉNIX:',
            error,
          )

          if (
            active
          ) {
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
    appState ===
    'checking'
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
    appState ===
    'error'
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
          'today'
        }
      >
        <TodayPage
          isActive={
            section ===
            'today'
          }
          onOpenTraining={() =>
            setSection(
              'training',
            )
          }
          onOpenNutrition={() =>
            setSection(
              'nutrition',
            )
          }
          onOpenProgress={() =>
            setSection(
              'progress',
            )
          }
        />
      </div>

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

      <div
        className="fenix-view"
        hidden={
          section !==
          'progress'
        }
      >
        <ProgressPage />
      </div>

      <nav
        className="fenix-navigation"
        aria-label="Navegación principal"
      >
        <div className="fenix-navigation__inner">
          {(
            [
              [
                'today',
                'Hoy',
              ],
              [
                'training',
                'Training',
              ],
              [
                'nutrition',
                'Nutrition',
              ],
              [
                'progress',
                'Progreso',
              ],
            ] as const
          ).map(
            ([
              item,
              label,
            ]) => (
              <button
                key={item}
                type="button"
                className={
                  section ===
                  item
                    ? 'active'
                    : ''
                }
                aria-current={
                  section ===
                  item
                    ? 'page'
                    : undefined
                }
                onClick={() =>
                  setSection(
                    item,
                  )
                }
              >
                <span className="fenix-navigation__icon">
                  <NavigationIcon
                    section={
                      item
                    }
                  />
                </span>

                <span className="fenix-navigation__label">
                  {label}
                </span>
              </button>
            ),
          )}
        </div>
      </nav>
    </div>
  )
}

export default App