/* This module intentionally co-locates the navigation provider and component;
   the provider is the owner of the transient-sheet lifecycle. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type AppSection = 'today' | 'training' | 'nutrition' | 'progress'
const ITEMS = [['today','Hoy'],['training','Training'],['nutrition','Nutrition'],['progress','Progreso']] as const
interface NavigationState {
  current: AppSection
  settings: boolean
  overlays: number
  navigate: (section: AppSection) => void
  register: (close: () => void) => () => void
}
const NavigationContext = createContext<NavigationState | null>(null)

export function NavigationProvider({ current, settings, onNavigate, children }: { current: AppSection; settings: boolean; onNavigate: (section: AppSection) => void; children: ReactNode }) {
  const closures = useRef(new Set<() => void>())
  const [overlays, setOverlays] = useState(0)
  const register = useCallback((close: () => void) => {
    closures.current.add(close)
    setOverlays(closures.current.size)
    return () => { closures.current.delete(close); setOverlays(closures.current.size) }
  }, [])
  const value = useMemo(() => ({ current, settings, overlays, register, navigate: (section: AppSection) => {
    // Close only transient presentation surfaces; saving is still owned by each domain.
    for (const close of closures.current) close()
    onNavigate(section)
  } }), [current, settings, overlays, register, onNavigate])
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useSheetNavigation(open: boolean, onClose: () => void) {
  const context = useContext(NavigationContext)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const register = context?.register
  useEffect(() => open && register ? register(() => closeRef.current()) : undefined, [open, register])
}

function NavigationIcon({ section, trainingStyle }: { section: AppSection; trainingStyle: boolean }) {
  const paths: Record<AppSection,string> = {
    today: trainingStyle ? 'M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0' : 'M3.5 10.5 12 3l8.5 7.5M5.5 9.5V21h13V9.5M9.5 21v-6h5v6',
    training:'M7 6v12m10-12v12M3 9v6m18-6v6M7 12h10',
    nutrition: trainingStyle ? 'M2 12h20c0 7-5 9-10 9S2 19 2 12ZM8 8l2-3m3 2 2-3m2 5 2-3M7 2h.01M3 7h.01' : 'M7 3v7M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 10v11M16 3c2 1.5 3 4 3 7v11M16 3v9h3',
    progress:'M5 20V12M12 20V4M19 20V8',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={trainingStyle && (section === 'training' || section === 'progress') ? '3.7' : '1.8'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[section]} /></svg>
}

export function AppNavigation({ insideSheet = false }: { insideSheet?: boolean }) {
  const context = useContext(NavigationContext)
  if (!context || (!insideSheet && context.overlays > 0)) return null
  const trainingStyle = context.current === 'training' && !context.settings
  return <nav className={`fenix-navigation${trainingStyle ? ' fenix-navigation--training' : ''}${context.current === 'nutrition' ? ' fenix-navigation--nutrition' : ''}`} aria-label="Navegación principal"><div className="fenix-navigation__inner">{ITEMS.map(([section,label]) => <button key={section} type="button" data-section={section} aria-label={label} className={!context.settings && context.current === section ? 'active' : ''} aria-current={!context.settings && context.current === section ? 'page' : undefined} onClick={() => context.navigate(section)}><span className="fenix-navigation__icon"><NavigationIcon section={section} trainingStyle={trainingStyle} /></span><span className="fenix-navigation__label">{trainingStyle && section === 'nutrition' ? 'Nutrición' : label}</span></button>)}</div></nav>
}
