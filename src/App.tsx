import {
  Suspense,
  lazy,
  useEffect,
  useState,
} from 'react'

import { useAppFreshness } from './app/useAppFreshness'
import { initializeDatabase } from './db/database'
import { ensureTrainingSeed } from './features/training/trainingSeed'
import { ensureNutritionSeed } from './features/nutrition/nutritionSeed'
import { ensureTodaySeed } from './features/today/todaySeed'
import TodayPage from './features/today/TodayPage'
import { ensureProgressSeed } from './features/progress/progressSeed'
import { ensureVNextDataMigrations } from './services/vNextMigrationService'
import { OfflineIndicator, UpdateAvailableBanner } from './components/designSystem'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { usePwaUpdateState } from './hooks/usePwaUpdateState'
import { useAppBadge } from './hooks/useAppBadge'
import { AppNavigation, NavigationProvider, type AppSection } from './components/AppNavigation'
import type { SettingsRoute } from './features/settings/SettingsPage'

import './styles/app.css'

const TrainingPage = lazy(() => import('./features/training/TrainingPage'))
const NutritionPage = lazy(() => import('./features/nutrition/NutritionPage'))
const ProgressPage = lazy(() => import('./features/progress/ProgressPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

type AppState = 'checking' | 'ready' | 'error'
function LoadingSurface() {
  return <main className="fenix-route-loading"><img src="/fenix-icon-192.png" alt="" /><p>Preparando FÉNIX…</p></main>
}

function App() {
  const [appState, setAppState] = useState<AppState>('checking')
  const [section, setSection] = useState<AppSection>('today')
  const [visited, setVisited] = useState<Set<AppSection>>(() => new Set(['today']))
  const [settings, setSettings] = useState<{ open: boolean; route: SettingsRoute }>({ open: false, route: 'home' })
  const freshness = useAppFreshness()
  const online = useOnlineStatus()
  const pwaUpdate = usePwaUpdateState(freshness.revision)
  useAppBadge(freshness.revision)

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
    void initializeApp()
      .then(() => {
        if (!active) return
        setAppState('ready')
      })
      .catch((error: unknown) => {
        console.error('Error inicializando FÉNIX:', error)
        if (active) setAppState('error')
      })
    return () => { active = false }
  }, [])

  function navigate(next: AppSection) {
    setVisited((current) => new Set(current).add(next))
    setSection(next)
    setSettings((current) => ({ ...current, open: false }))
  }

  function openSettings(route: SettingsRoute = 'home') {
    setSettings({ open: true, route })
  }

  if (appState === 'checking') return <LoadingSurface />
  if (appState === 'error') return (
    <main className="fenix-route-loading fenix-route-loading--error">
      <img src="/fenix-icon-192.png" alt="" />
      <h1>FÉNIX</h1>
      <p>No se ha podido iniciar la base local. Tus datos existentes no han sido borrados.</p>
    </main>
  )

  return (
    <NavigationProvider current={section} settings={settings.open} onNavigate={navigate}><div className="fenix-app">
      <OfflineIndicator offline={!online} />
      <UpdateAvailableBanner visible={pwaUpdate.visible} deferred={pwaUpdate.deferred} onApply={() => void pwaUpdate.apply()} />

      <div className="fenix-view" hidden={settings.open || section !== 'today'}>
        <TodayPage
          isActive={!settings.open && section === 'today'}
          dateKey={freshness.dateKey}
          refreshRevision={freshness.revision}
          onOpenTraining={() => navigate('training')}
          onOpenNutrition={() => navigate('nutrition')}
          onOpenProgress={() => navigate('progress')}
          onOpenSettings={() => openSettings('home')}
          onOpenRoutineSettings={() => openSettings('routine')}
        />
      </div>

      <Suspense fallback={<LoadingSurface />}>
        {visited.has('training') ? (
          <div className="fenix-view" hidden={settings.open || section !== 'training'}>
            <TrainingPage isActive={!settings.open && section === 'training'} refreshRevision={freshness.revision} onOpenSettings={() => openSettings('home')} />
          </div>
        ) : null}
        {visited.has('nutrition') ? (
          <div className="fenix-view" hidden={settings.open || section !== 'nutrition'}>
            <NutritionPage isActive={!settings.open && section === 'nutrition'} refreshRevision={freshness.revision} onOpenSettings={() => openSettings('home')} />
          </div>
        ) : null}
        {visited.has('progress') ? (
          <div className="fenix-view" hidden={settings.open || section !== 'progress'}>
            <ProgressPage isActive={!settings.open && section === 'progress'} refreshRevision={freshness.revision} onOpenSettings={() => openSettings('home')} onOpenDataSettings={() => openSettings('data')} />
          </div>
        ) : null}
        {settings.open ? <SettingsPage key={settings.route} initialRoute={settings.route} onClose={() => setSettings((current) => ({ ...current, open: false }))} /> : null}
      </Suspense>

      <AppNavigation />
    </div></NavigationProvider>
  )
}

export default App
