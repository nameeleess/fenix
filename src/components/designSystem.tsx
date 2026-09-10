import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'

import { AppNavigation, useSheetNavigation } from './AppNavigation'
import { formatLongDate, parseDateKey } from '../utils/date'

export function PhoenixHeaderArtwork() {
  return (
    <div className="ds-phoenix-art" aria-hidden="true">
      <img src="/fenix-header-art.webp" alt="" />
    </div>
  )
}

export function AppHeader({
  title,
  kicker = 'FÉNIX',
  subtitle,
  dateKey,
  onSettings,
  action,
  back,
  backPlacement = 'stacked',
  compact = false,
}: {
  title: string
  kicker?: string
  subtitle?: string
  dateKey?: string
  onSettings?: () => void
  action?: ReactNode
  back?: { label?: string; onClick: () => void }
  backPlacement?: 'stacked' | 'inline' | 'breadcrumb'
  compact?: boolean
}) {
  const resolvedSubtitle = subtitle ?? (dateKey ? formatLongDate(dateKey) : null)

  return (
    <header className={`ds-app-header${compact ? ' ds-app-header--compact' : ''}${back ? ` ds-app-header--back ds-app-header--back-${backPlacement}` : ''}`}>
      <div className="ds-app-header__main">
        {back ? (
          <button
            type="button"
            className="ds-icon-button ds-app-header__back"
            aria-label={back.label ?? 'Volver'}
            onClick={back.onClick}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4-8 8 8 8" /></svg>{backPlacement === 'breadcrumb' ? <span>Ajustes</span> : null}
          </button>
        ) : null}
        <div className="ds-app-header__copy">
          <span className="ds-kicker">{kicker}</span>
          <h1>{title}</h1>
          {resolvedSubtitle ? <p>{resolvedSubtitle}</p> : null}
        </div>
      </div>
      <PhoenixHeaderArtwork />
      <div className="ds-app-header__actions">
        {action}
        {onSettings ? (
          <button
            type="button"
            className="ds-icon-button"
            aria-label="Abrir Ajustes"
            onClick={onSettings}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
              <path d="M19.2 13.1a7.8 7.8 0 0 0 0-2.2l2-1.5-2-3.4-2.5 1a8.5 8.5 0 0 0-1.9-1.1L14.5 3h-4l-.4 2.9A8.5 8.5 0 0 0 8.3 7l-2.6-1-2 3.4 2.1 1.5a7.8 7.8 0 0 0 0 2.2l-2 1.5 2 3.4 2.5-1a8.5 8.5 0 0 0 1.9 1.1l.4 2.9h4l.4-2.9a8.5 8.5 0 0 0 1.9-1.1l2.5 1 2-3.4-2.2-1.5Z" />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  )
}

export type WeekDayState = 'idle' | 'pending' | 'active' | 'completed' | 'incomplete' | 'omitted' | 'today'

export function WeekDaySelector({
  days,
  selectedDate,
  actualToday,
  onSelect,
}: {
  days: Array<{ date: string; state?: WeekDayState; badge?: string | number | null }>
  selectedDate: string
  actualToday: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="ds-week-selector" role="group" aria-label="Selector semanal">
      {days.map((day) => {
        const date = parseDateKey(day.date)
        const isSelected = day.date === selectedDate
        const isToday = day.date === actualToday
        return (
          <button
            key={day.date}
            type="button"
            className={`ds-week-day ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} state-${day.state ?? 'idle'}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(day.date)}
          >
            <span>{new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '').slice(0, 2)}</span>
            <strong>{date.getDate()}</strong>
            <i />
            {day.badge ? <small>{day.badge}</small> : null}
          </button>
        )
      })}
    </div>
  )
}

export function SegmentedTabs<T extends string>({
  value,
  items,
  onChange,
  label,
}: {
  value: T
  items: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <nav className="ds-segmented" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? 'is-active' : ''}
          aria-current={value === item.value ? 'page' : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export function Surface({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`ds-surface ${className}`} />
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <article {...props} className={`ds-card ${className}`} />
}

function ButtonBase({ variant, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant: string }) {
  return <button {...props} className={`ds-button ds-button--${variant} ${className}`} />
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <ButtonBase {...props} variant="primary" />
}
export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <ButtonBase {...props} variant="secondary" />
}
export function GhostButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <ButtonBase {...props} variant="ghost" />
}
export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return <button {...rest} className={`ds-icon-button ${className}`} />
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  return <span className={`ds-pill ds-pill--${tone}`}>{children}</span>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  return <Pill tone={tone}>{children}</Pill>
}

export function MetricCard({ label, value, detail, accent = false }: { label: string; value: ReactNode; detail?: ReactNode; accent?: boolean }) {
  return (
    <Card className={`ds-metric ${accent ? 'ds-metric--accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </Card>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="ds-empty-state">
      <img src="/fenix-icon-192.png" alt="" />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function MediaFrame({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <figure className={`ds-media-frame ${className}`} aria-label={label}>
      {children}
    </figure>
  )
}

function useDialogFocus(open: boolean, onClose: () => void, dismissible = true) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = ref.current
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () => root?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []
    window.setTimeout(() => focusables()[0]?.focus(), 0)

    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !root) return
      const nodes = Array.from(focusables())
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = bodyOverflow
      previous.current?.focus()
    }
  }, [open, dismissible])

  return ref
}

export function Dialog({ open, title, description, children, onClose, destructive = false, dismissible = true, className = '' }: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  destructive?: boolean
  dismissible?: boolean
  className?: string
}) {
  const titleId = useId()
  const descriptionId = useId()
  const ref = useDialogFocus(open, onClose, dismissible)
  if (!open) return null

  return (
    <div className="ds-dialog-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose() }}>
      <div
        ref={ref}
        className={`ds-dialog ${destructive ? 'ds-dialog--danger' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </header>
        {children}
      </div>
    </div>
  )
}

export function Sheet({ open, title, subtitle, children, onClose, header, className = '' }: {
  open: boolean
  title: string
  subtitle?: string
  header?: ReactNode
  className?: string
  children: ReactNode
  onClose: () => void
}) {
  const titleId = useId()
  const ref = useDialogFocus(open, onClose)
  useSheetNavigation(open, onClose)
  if (!open) return null
  return (
    <div className="ds-dialog-backdrop ds-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={ref} className={`ds-sheet ${className}`} role="dialog" aria-modal="true" aria-label={header ? title : undefined} aria-labelledby={header ? undefined : titleId}>
        {header ?? <header className="ds-sheet__header">
          <button type="button" className="ds-icon-button" aria-label="Cerrar" onClick={onClose}>‹</button>
          <div><span className="ds-kicker">FÉNIX</span><h2 id={titleId}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        </header>}
        <div className="ds-sheet__content">{children}</div>
        <AppNavigation insideSheet />
      </div>
    </div>
  )
}

export function ConfirmAction({ open, title, description, confirmLabel = 'Confirmar', onConfirm, onCancel, busy = false }: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onCancel} destructive dismissible={!busy}>
      <div className="ds-dialog__actions">
        <SecondaryButton type="button" onClick={onCancel} disabled={busy}>Cancelar</SecondaryButton>
        <PrimaryButton type="button" onClick={() => void onConfirm()} disabled={busy}>{busy ? 'Procesando…' : confirmLabel}</PrimaryButton>
      </div>
    </Dialog>
  )
}

export function Toast({ message, tone = 'success', onDismiss }: { message: string; tone?: 'success' | 'error' | 'info'; onDismiss?: () => void }) {
  if (!message) return null
  return (
    <div className={`ds-toast ds-toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onDismiss ? <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>×</button> : null}
    </div>
  )
}

export function OfflineIndicator({ offline }: { offline: boolean }) {
  if (!offline) return null
  return <div className="ds-offline" role="status">Sin conexión · tus datos siguen guardándose en este dispositivo</div>
}

export function UpdateAvailableBanner({ visible, deferred, onApply }: { visible: boolean; deferred?: boolean; onApply: () => void }) {
  if (!visible) return null
  return (
    <div className="ds-update-banner" role="status">
      <div><strong>Nueva versión disponible</strong><span>{deferred ? 'Se aplicará cuando termines la sesión activa.' : 'Lista para aplicar en un punto seguro.'}</span></div>
      {!deferred ? <button type="button" onClick={onApply}>Actualizar</button> : null}
    </div>
  )
}
