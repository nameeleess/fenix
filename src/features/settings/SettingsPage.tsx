import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { db } from '../../db/database'
import {
  AppHeader,
  ConfirmAction,
  PrimaryButton,
  StatusBadge,
  Surface,
  Toast,
} from '../../components/designSystem'
import {
  exportFenixBackup,
  readAndValidateBackupFile,
  restoreFenixBackup,
  type BackupValidationResult,
  type FenixBackup,
} from '../../services/backupService'
import {
  getRoutineTemplateEditorView,
  saveRoutineTemplate,
  type RoutineTemplateItemInput,
} from '../today/todayService'
import type { TodayApplicability, TodayBlock } from '../../types/today'
import './settings.css'
import { SectionIcon } from '../../components/SectionIcon'
import { createUuid } from '../../utils/uuid'

export type SettingsRoute =
  | 'home'
  | 'routine'
  | 'data'
  | 'notifications'
  | 'training'
  | 'nutrition'
  | 'progress'
  | 'pwa'
  | 'credits'

const GROUPS: Array<{ route: SettingsRoute; icon: string; title: string; description: string }> = [
  { route: 'routine', icon: '◔', title: 'Rutina diaria', description: 'Preferencias de rutina, hábitos y objetivos' },
  { route: 'data', icon: '▣', title: 'Datos y backup', description: 'Sincronización, exportación y seguridad' },
  { route: 'notifications', icon: '◌', title: 'Notificaciones', description: 'Recordatorios y alertas' },
  { route: 'training', icon: '↟', title: 'Training', description: 'Configuración de entrenamientos' },
  { route: 'nutrition', icon: '⌁', title: 'Nutrition', description: 'Preferencias de nutrición y comidas' },
  { route: 'progress', icon: '⌁', title: 'Progreso', description: 'Objetivos, métricas y visualización' },
  { route: 'pwa', icon: '◎', title: 'PWA y offline', description: 'Uso sin conexión y almacenamiento local' },
  { route: 'credits', icon: 'ⓘ', title: 'Créditos', description: 'Versión, licencias y agradecimientos' },
]

const BLOCKS: Array<{ value: TodayBlock; label: string }> = [
  { value: 'morning', label: 'Mañana' },
  { value: 'postworkout', label: 'Post-entreno' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'work', label: 'Trabajo' },
  { value: 'night', label: 'Noche' },
]

const APPLICABILITY: Array<{ value: TodayApplicability; label: string }> = [
  { value: 'always', label: 'Siempre' },
  { value: 'training_day', label: 'Día Training' },
  { value: 'non_training_day', label: 'Día sin Training' },
  { value: 'work_day', label: 'Día laboral' },
  { value: 'non_work_day', label: 'Día libre' },
  { value: 'manual', label: 'Manual' },
]

interface EditorItem extends RoutineTemplateItemInput { clientKey: string; enabled: boolean }

function nextOrders(items: EditorItem[]) {
  const counters = new Map<TodayBlock, number>()
  return items.map((item) => {
    const order = (counters.get(item.block) ?? 0) + 10
    counters.set(item.block, order)
    return { ...item, order }
  })
}

function SettingsHome({ onNavigate }: { onNavigate: (route: SettingsRoute) => void }) {
  return (
    <div className="settings-list">
      {[GROUPS.slice(0, 3), GROUPS.slice(3, 6), GROUPS.slice(6, 7), GROUPS.slice(7)].map((group) => (
      <div className="settings-group" key={group[0].route}>
      {group.map((item) => (
        <button key={item.route} type="button" className={`settings-row settings-row--${item.route}`} onClick={() => onNavigate(item.route)}>
          <span className="settings-row__icon" aria-hidden="true"><SectionIcon name={item.route}/></span>
          <span><strong>{item.title}</strong><small>{item.description}</small></span>
          {item.route === 'credits' ? <span className="settings-row__meta"><strong>v2.1</strong><small>Local-first · Offline listo</small></span> : null}
          <SectionIcon name="chevron" />
        </button>
      ))}
      </div>
      ))}
    </div>
  )
}

function RoutineSettings() {
  const [items, setItems] = useState<EditorItem[]>([])
  const [wakeTime, setWakeTime] = useState('07:00')
  const [dayType, setDayType] = useState<'work' | 'free'>('work')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState<TodayBlock | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([
      getRoutineTemplateEditorView(),
      db.appMeta.bulkGet(['v21:routineWakeTime', 'v21:routineDefaultDayType']),
    ]).then(([view, meta]) => {
      if (!active) return
      setItems(nextOrders(view.items.map((item) => ({ ...item, clientKey: item.id, enabled: true }))))
      setWakeTime(meta[0]?.value || '07:00')
      setDayType(meta[1]?.value === 'free' ? 'free' : 'work')
      setLoading(false)
    }).catch((loadError) => {
      if (!active) return
      setError(loadError instanceof Error ? loadError.message : 'No se ha podido cargar la rutina.')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const grouped = useMemo(() => BLOCKS.map((block) => ({ ...block, items: items.filter((item) => item.block === block.value) })), [items])

  function patch(clientKey: string, value: Partial<EditorItem>) {
    setItems((current) => nextOrders(current.map((item) => item.clientKey === clientKey ? { ...item, ...value } : item)))
  }

  function add(block: TodayBlock) {
    setItems((current) => nextOrders([...current, {
      clientKey: `new-${createUuid()}`,
      block,
      order: 10,
      title: 'Nuevo paso',
      description: null,
      applicability: 'always',
      targetTime: null,
      latestTime: null,
      timingDays: null,
      enabled: true,
    }]))
  }

  function move(clientKey: string, direction: -1 | 1) {
    setItems((current) => {
      const item = current.find((candidate) => candidate.clientKey === clientKey)
      if (!item) return current
      const same = current.filter((candidate) => candidate.block === item.block)
      const local = same.findIndex((candidate) => candidate.clientKey === clientKey)
      const target = same[local + direction]
      if (!target) return current
      const next = [...current]
      const a = next.findIndex((candidate) => candidate.clientKey === item.clientKey)
      const b = next.findIndex((candidate) => candidate.clientKey === target.clientKey)
      ;[next[a], next[b]] = [next[b], next[a]]
      return nextOrders(next)
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (items.some((item) => item.enabled && !item.title.trim())) {
      setError('Todos los pasos activos necesitan un nombre.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const activeItems = nextOrders(items.filter((item) => item.enabled)).map((item) => ({ id: item.id, block: item.block, order: item.order, title: item.title, description: item.description, applicability: item.applicability, targetTime: item.targetTime, latestTime: item.latestTime, timingDays: item.timingDays }))
      await saveRoutineTemplate(activeItems, {
        settings: { wakeTime, defaultDayType: dayType },
      })
      setMessage('Rutina diaria guardada. Los días históricos no se han reescrito.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar la rutina.')
    } finally { setSaving(false) }
  }

  if (loading) return <p className="settings-loading">Cargando rutina…</p>

  return (
    <form className="settings-routine" onSubmit={save}>
      <Surface className="settings-wake">
        <span className="settings-row__icon"><SectionIcon name="routine" /></span>
        <label><strong>Hora de despertar</strong><small>Esta hora se usa para planificar tu día.</small><input aria-label="Hora de despertar" type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} /></label>
      </Surface>
      <Surface className="settings-day-type">
        <div className="settings-routine-heading"><span className="settings-row__icon"><SectionIcon name="calendar" /></span><div><h3>Tipo de día</h3><p>Define qué rutina cargar por defecto.</p></div></div>
        <div className="settings-toggle-pair">{(['work', 'free'] as const).map(value => <button type="button" key={value} aria-pressed={dayType === value} className={dayType === value ? 'is-active' : ''} onClick={() => setDayType(value)}><SectionIcon name={value === 'work' ? 'work' : 'free'} /><span><strong>{value === 'work' ? 'Día laboral' : 'Día libre'}</strong><small>{value === 'work' ? 'Rutina de trabajo' : 'Rutina personal'}</small></span><i aria-hidden="true">{dayType === value ? '✓' : ''}</i></button>)}</div>
      </Surface>

      {grouped.filter(group => group.items.length > 0).map((group) => (
        <section className="settings-routine-block" key={group.value}>
          <header><span className="settings-block-icon"><SectionIcon name={group.value === 'morning' ? 'routine' : group.value === 'night' ? 'moon' : 'energy'} /></span><div><h3>{group.label}</h3><p>{group.items.length} tareas · {group.value === 'morning' ? 'Empieza tu día con energía.' : group.value === 'night' ? 'Desconecta y recarga.' : 'Enfoca y construye.'}</p></div><button type="button" aria-pressed={reordering === group.value} onClick={() => setReordering(reordering === group.value ? null : group.value)}>↕ Reordenar</button></header>
          <div className="settings-routine-items">
            {group.items.map((item, index) => (
              <article key={item.clientKey} className={item.enabled ? '' : 'is-disabled'}>
                <details className="settings-routine-item__editor" open={reordering === group.value ? true : undefined}>
                  <summary><SectionIcon name="grip" /><span>{item.title}<small>{item.targetTime || 'Sin hora fija'}{item.description ? ` · ${item.description}` : ''}</small></span></summary>
                <div className="settings-routine-item__fields">
                  <input aria-label="Nombre del paso" value={item.title} onChange={(event) => patch(item.clientKey, { title: event.target.value })} />
                  <div><select aria-label="Aplicabilidad" value={item.applicability} onChange={(event) => patch(item.clientKey, { applicability: event.target.value as TodayApplicability })}>{APPLICABILITY.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input aria-label="Hora objetivo" type="time" value={item.targetTime ?? ''} onChange={(event) => patch(item.clientKey, { targetTime: event.target.value || null })} /></div>
                </div>
                <div className="settings-routine-item__order"><button type="button" aria-label={`Subir ${item.title}`} disabled={index === 0} onClick={() => move(item.clientKey, -1)}>↑</button><button type="button" aria-label={`Bajar ${item.title}`} disabled={index === group.items.length - 1} onClick={() => move(item.clientKey, 1)}>↓</button></div>
                </details>
                <label className="settings-switch"><input type="checkbox" aria-label={`Activar ${item.title}`} checked={item.enabled} onChange={(event) => patch(item.clientKey, { enabled: event.target.checked })} /><span /></label>
              </article>
            ))}
          </div>
          <button type="button" className="settings-add-task" onClick={() => add(group.value)}>⊕ Añadir tarea</button>
        </section>
      ))}
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      {message ? <Toast message={message} onDismiss={() => setMessage('')} /> : null}
      <PrimaryButton type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</PrimaryButton>
      {grouped.some(group => !group.items.length) ? <details className="settings-other-blocks"><summary>Otros bloques</summary>{grouped.filter(group => !group.items.length).map(group => <button type="button" key={group.value} onClick={() => add(group.value)}>Añadir {group.label}</button>)}</details> : null}
    </form>
  )
}

function DataSettings() {
  const [busy, setBusy] = useState(false)
  const [backup, setBackup] = useState<FenixBackup | null>(null)
  const [validation, setValidation] = useState<BackupValidationResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastBackup, setLastBackup] = useState<{ exportedAt: string; fileName: string; totalRecords: number } | null>(null)

  useEffect(() => {
    let active = true
    void db.appMeta.get('v21:lastBackupExport').then((record) => {
      if (!active || !record?.value) return
      try {
        const parsed = JSON.parse(record.value) as { exportedAt?: string; fileName?: string; totalRecords?: number }
        if (parsed.exportedAt && parsed.fileName && typeof parsed.totalRecords === 'number') {
          setLastBackup({ exportedAt: parsed.exportedAt, fileName: parsed.fileName, totalRecords: parsed.totalRecords })
        }
      } catch {
        // Metadata auxiliar corrupta no invalida la base ni un backup real.
      }
    })
    return () => { active = false }
  }, [])

  async function exportBackup() {
    setBusy(true); setError('')
    try {
      const result = await exportFenixBackup()
      setLastBackup({ exportedAt: result.exportedAt, fileName: result.fileName, totalRecords: result.totalRecords })
      setMessage(`Backup ${result.fileName} · ${result.totalRecords} registros.`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se ha podido exportar.')
    } finally { setBusy(false) }
  }

  async function selectFile(file: File | null) {
    setBackup(null); setValidation(null); setFileName(file?.name ?? ''); setError('')
    if (!file) return
    try {
      const result = await readAndValidateBackupFile(file)
      setBackup(result.backup)
      setValidation(result.validation)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'No se ha podido leer el backup.')
    }
  }

  async function restore() {
    if (!backup) return
    setBusy(true); setError('')
    try {
      await restoreFenixBackup(backup)
      setConfirm(false)
      setMessage('Backup restaurado y verificado. FÉNIX seguirá usando schema 5.')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'La restauración no se ha completado.')
    } finally { setBusy(false) }
  }

  return (
    <div className="settings-data">
      <Surface className="settings-data-summary">
        <div className="settings-data-status"><span className="settings-data-status__icon"><SectionIcon name="data" /></span><div><h2>Datos almacenados localmente</h2><p>Tu información se guarda en este dispositivo<br />y funciona sin conexión.</p></div></div>
        <div className="settings-backup-fact"><SectionIcon name="clock" /><div><strong>Último backup</strong><small>{lastBackup ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(lastBackup.exportedAt)) : 'Aún no has exportado un backup'}</small></div></div>
      </Surface>
      <div className="settings-data-actions settings-group">
        <button type="button" className="settings-action-row" onClick={() => void exportBackup()} disabled={busy}><span><SectionIcon name="export" /></span><div><strong>Exportar backup</strong><small>Genera un archivo con todos los datos (JSON)</small></div><SectionIcon name="chevron" /></button>
        <label className="settings-action-row settings-action-row--file"><span><SectionIcon name="import" /></span><div><strong>Restaurar desde archivo</strong><small>Importa un backup y recupera tu información</small></div><SectionIcon name="chevron" /><input type="file" aria-label="Seleccionar backup JSON" accept="application/json,.json" disabled={busy} onChange={(event) => void selectFile(event.target.files?.[0] ?? null)} /></label>
        <div className="settings-action-row" data-central-exception="CENTRAL-AUTOEXCEPTION-G26-STANDALONE-INTEGRITY-01"><span><SectionIcon name="shield" /></span><div><strong>Validar integridad</strong><small>Se valida al seleccionar y restaurar un backup</small></div></div>
      </div>
      {validation ? <Surface className={validation.valid ? 'settings-validation is-valid' : 'settings-validation is-invalid'}><strong>{validation.valid ? 'Backup válido' : 'Backup rechazado'}</strong><span>{fileName}</span><p>Schema {validation.schemaVersion ?? '—'} · {validation.totalRecords ?? '—'} registros</p>{validation.errors.map((item) => <small key={item}>{item}</small>)}</Surface> : null}
      {validation?.valid && backup ? <PrimaryButton type="button" onClick={() => setConfirm(true)}>Restaurar este backup</PrimaryButton> : null}
      <h3 className="settings-section-label">INFORMACIÓN</h3>
      <div className="settings-group settings-data-information">
        <div className="settings-action-row"><span><SectionIcon name="bulb" /></span><div><strong>Recomendaciones</strong><small>Haz un backup regularmente, especialmente antes de cambiar de dispositivo.</small></div></div>
        <div className="settings-action-row"><span><SectionIcon name="file" /></span><div><strong>Formato JSON</strong><small>Los backups se guardan en formato JSON, legible y compatible.</small></div></div>
      </div>
      <h3 className="settings-section-label">ZONA DE PELIGRO</h3>
      <Surface className="settings-danger-zone"><button type="button" className="settings-action-row" disabled data-central-exception="CENTRAL-EXCEPTION-G26-DELETE-ALL-DATA-01"><span aria-hidden="true"><SectionIcon name="trash" /></span><div><strong>Borrar datos locales</strong><small>No disponible</small></div></button></Surface>
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      {message ? <Toast message={message} onDismiss={() => setMessage('')} /> : null}
      <ConfirmAction open={confirm} title="Restaurar backup" description="Esta operación reemplaza todos los datos locales únicamente después de que el archivo haya superado la validación. Si algo falla, la transacción revierte." confirmLabel="Restaurar" busy={busy} onCancel={() => setConfirm(false)} onConfirm={restore} />
    </div>
  )
}

function InfoSettings({ route }: { route: SettingsRoute }) {
  if (route === 'credits') return (
    <div className="settings-info-stack">
      <Surface><span className="ds-kicker">VERSIÓN</span><h2>FÉNIX 2.1.0-rc.1.2</h2><p>CORE v2.0.0 preservado · local-first · offline-first.</p></Surface>
      <Surface><span className="ds-kicker">MEDIA DE EJERCICIO</span><h3>Catálogo local 33/33</h3><p>31 media licenciada aportada por el usuario · 1 RepDB · 1 FÉNIX. Los masters y fallbacks se conservan offline.</p></Surface>
      <Surface><span className="ds-kicker">ATRIBUCIÓN</span><h3>RepDB · Gymvisual · FÉNIX</h3><p>Mappings, hashes y autorización documentados en el registro de evidencia. No se cargan URLs remotas.</p></Surface>
    </div>
  )

  if (route === 'pwa') return (
    <div className="settings-info-stack"><Surface><span className="ds-kicker">PWA / OFFLINE</span><h2>Diseñada para seguir funcionando</h2><p>El shell, los datos y media FÉNIX quedan locales. Las ilustraciones RepDB seleccionadas se empaquetan localmente desde @repdb/exercises; los detalles se cachean al primer uso y ExerciseMotion local permanece como fallback.</p><StatusBadge tone={navigator.onLine ? 'success' : 'warning'}>{navigator.onLine ? 'Online' : 'Offline'}</StatusBadge></Surface><Surface><h3>Actualizaciones seguras</h3><p>Una actualización disponible se muestra en la app y no se aplica automáticamente mientras exista una sesión Training activa.</p></Surface></div>
  )

  if (route === 'notifications') return (
    <div className="settings-info-stack"><Surface><span className="ds-kicker">NOTIFICACIONES</span><h2>Capacidad honesta</h2><p>FÉNIX no promete recordatorios programados con la app cerrada sin infraestructura push. Badging se activa solo cuando la API está disponible.</p><StatusBadge tone={'neutral'}>{'setAppBadge' in navigator ? 'Badging disponible' : 'Badging no disponible'}</StatusBadge></Surface></div>
  )

  const copy: Record<string, [string,string]> = {
    training: ['Training', 'Sesiones, rutinas, catálogo y media mantienen ownership en Training. Wake Lock se activa solo durante sesión activa cuando el navegador lo soporta.'],
    nutrition: ['Nutrition', 'Plan, consumo, recetas y compra mantienen su identidad local. El seed no se incrementa ni sobrescribe ediciones de usuario en v2.1.'],
    progress: ['Progreso', 'Peso, medidas, tendencias, racha y objetivos históricos permanecen bajo Progreso. Corregir y eliminar son acciones distintas.'],
  }
  const [title, description] = copy[route] ?? ['Ajustes', 'Configuración de FÉNIX.']
  return <div className="settings-info-stack"><Surface><span className="ds-kicker">{title}</span><h2>{title}</h2><p>{description}</p></Surface></div>
}

export default function SettingsPage({ onClose, initialRoute = 'home' }: { onClose: () => void; initialRoute?: SettingsRoute }) {
  const [route, setRoute] = useState<SettingsRoute>(initialRoute)
  const titles: Record<SettingsRoute,string> = {
    home: 'Ajustes', routine: 'Rutina diaria', data: 'Datos y backup', notifications: 'Notificaciones', training: 'Training', nutrition: 'Nutrition', progress: 'Progreso', pwa: 'PWA y offline', credits: 'Créditos',
  }

  return (
    <main className={`settings-page settings-page--${route} ds-page`}>
      <AppHeader
        title={titles[route]}
        kicker="FÉNIX"
        backPlacement={route === 'home' ? 'stacked' : route === 'data' ? 'breadcrumb' : 'inline'}
        subtitle={route === 'home' ? 'Personaliza tu experiencia' : route === 'data' ? 'Tu información. Siempre contigo.' : route === 'routine' ? 'Configura tu rutina para que Hoy se adapte a tu día y te muestre las tareas correctas.' : 'Ajustes'}
        back={route === 'home' ? { label: 'Cerrar Ajustes', onClick: onClose } : { label: 'Volver a Ajustes', onClick: () => setRoute('home') }}
      />
      {route === 'home' ? <SettingsHome onNavigate={setRoute} /> : null}
      {route === 'routine' ? <RoutineSettings /> : null}
      {route === 'data' ? <DataSettings /> : null}
      {route !== 'home' && route !== 'routine' && route !== 'data' ? <InfoSettings route={route} /> : null}
    </main>
  )
}
