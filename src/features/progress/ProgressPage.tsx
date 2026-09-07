import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import type {
  BodyMeasurement,
  WeightEntry,
} from '../../types/progress'
import {
  exportFenixBackup,
  readAndValidateBackupFile,
  restoreFenixBackup,
  type FenixBackup,
} from '../../services/backupService'
import {
  addBodyMeasurement,
  addWeightEntry,
  deleteBodyMeasurement,
  deleteWeightEntry,
  getBodyMeasurements,
  getFeaturedExerciseOptions,
  getFeaturedExercisePerformance,
  getProgressSummary,
  getWeightHistory,
  setFeaturedExercises,
  type ProgressSummary,
} from './progressService'
import './progress.css'

type ProgressView =
  | 'summary'
  | 'weight'
  | 'performance'
  | 'adherence'
  | 'body'
  | 'data'

interface ProgressPageProps {
  isActive: boolean
  refreshRevision: number
}

interface ExerciseOption {
  exercise: {
    id: string
    name: string
  }
  selected: boolean
}

interface PerformanceItem {
  exercise: {
    id: string
    name: string
  } | null
  latestSet: {
    weight: number | null
    reps: number | null
    rir: number | null
    completedAt: string | null
  } | null
  comparisonStatus: 'unknown'
}

interface ProgressData {
  nextSummary: ProgressSummary
  weights: WeightEntry[]
  body: BodyMeasurement[]
  options: ExerciseOption[]
  performanceItems: PerformanceItem[]
}

async function fetchProgressData(): Promise<ProgressData> {
  const [nextSummary, weights, body, options, performanceItems] =
    await Promise.all([
      getProgressSummary(),
      getWeightHistory(),
      getBodyMeasurements(),
      getFeaturedExerciseOptions(),
      getFeaturedExercisePerformance(),
    ])

  return {
    nextSummary,
    weights,
    body,
    options: options as ExerciseOption[],
    performanceItems: performanceItems as PerformanceItem[],
  }
}

function parseOptionalNumber(value: string) {
  const normalized = value.replace(',', '.').trim()

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatKg(value: number | null) {
  if (value === null) {
    return '—'
  }

  return `${value.toLocaleString('es-ES', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })} kg`
}

function formatCm(value: number | null) {
  if (value === null) {
    return '—'
  }

  return `${value.toLocaleString('es-ES', {
    maximumFractionDigits: 1,
  })} cm`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function PhoenixMark() {
  return (
    <img
      className="progress-phoenix-icon"
      src="/fenix-icon-192.png"
      alt=""
      aria-hidden="true"
    />
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="progress-back-button"
      onClick={onClick}
    >
      <span aria-hidden="true">‹</span>
      Resumen
    </button>
  )
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const points = useMemo(() => {
    if (entries.length === 0) {
      return []
    }

    const width = 320
    const height = 130
    const padding = 10
    const weights = entries.map((entry) => entry.weightKg)
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const span = Math.max(max - min, 0.8)

    return entries.map((entry, index) => {
      const x =
        entries.length === 1
          ? width / 2
          : padding + (index / (entries.length - 1)) * (width - padding * 2)
      const y = padding + ((max - entry.weightKg) / span) * (height - padding * 2)

      return { x, y, entry }
    })
  }, [entries])

  if (points.length === 0) {
    return (
      <div className="progress-chart-empty">
        La gráfica aparecerá cuando registres peso.
      </div>
    )
  }

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <div className="progress-chart" aria-label="Evolución de peso de las últimas cuatro semanas">
      <svg viewBox="0 0 320 130" role="img">
        <path className="progress-chart__grid" d="M10 32 H310 M10 65 H310 M10 98 H310" />
        {points.length > 1 ? <path className="progress-chart__line" d={path} /> : null}
        {points.map((point) => (
          <circle
            key={point.entry.id}
            className="progress-chart__point"
            cx={point.x}
            cy={point.y}
            r="4"
          />
        ))}
      </svg>
    </div>
  )
}

function MetricCard({
  eyebrow,
  title,
  value,
  detail,
  onClick,
}: {
  eyebrow: string
  title: string
  value: string
  detail: string
  onClick: () => void
}) {
  return (
    <button type="button" className="progress-metric-card" onClick={onClick}>
      <span className="progress-eyebrow">{eyebrow}</span>
      <div className="progress-metric-card__top">
        <h2>{title}</h2>
        <span aria-hidden="true">›</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </button>
  )
}

export default function ProgressPage({
  isActive,
  refreshRevision,
}: ProgressPageProps) {
  const [view, setView] = useState<ProgressView>('summary')
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([])
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [performance, setPerformance] = useState<PerformanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [weightValue, setWeightValue] = useState('')
  const [weightComparable, setWeightComparable] = useState(true)
  const [weightNote, setWeightNote] = useState('')

  const [waist, setWaist] = useState('')
  const [rightArm, setRightArm] = useState('')
  const [leftArm, setLeftArm] = useState('')
  const [bodyNote, setBodyNote] = useState('')

  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [backup, setBackup] = useState<FenixBackup | null>(null)
  const [backupName, setBackupName] = useState('')
  const [backupValidation, setBackupValidation] = useState<{
    valid: boolean
    errors: string[]
    warnings: string[]
    schemaVersion: number | null
    totalRecords: number | null
  } | null>(null)
  const [restoreApproved, setRestoreApproved] = useState(false)
  const [pendingWeightDelete, setPendingWeightDelete] = useState<string | null>(null)
  const [pendingBodyDelete, setPendingBodyDelete] = useState<string | null>(null)

  async function load() {
    const data = await fetchProgressData()

    setSummary(data.nextSummary)
    setWeightHistory(data.weights)
    setMeasurements(data.body)
    setExerciseOptions(data.options)
    setPerformance(data.performanceItems)
    setSelectedExercises(
      data.options
        .filter((item) => item.selected)
        .map((item) => item.exercise.id),
    )
  }

  useEffect(() => {
    if (!isActive) return

    let active = true

    const timer = window.setTimeout(() => {
      setLoading(true)

      void fetchProgressData()
        .then((data) => {
          if (!active) {
            return
          }

          setSummary(data.nextSummary)
          setWeightHistory(data.weights)
          setMeasurements(data.body)
          setExerciseOptions(data.options)
          setPerformance(data.performanceItems)
          setSelectedExercises(
            data.options
              .filter((item) => item.selected)
              .map((item) => item.exercise.id),
          )
          setError('')
          setLoading(false)
        })
        .catch((loadError: unknown) => {
          console.error('Error cargando Progreso:', loadError)

          if (active) {
            setError('No se ha podido cargar Progreso.')
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [isActive, refreshRevision])

  function clearFeedback() {
    setMessage('')
    setError('')
  }

  async function handleWeightSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    const weightKg = parseOptionalNumber(weightValue)

    if (weightKg === null) {
      setError('Introduce un peso válido.')
      return
    }

    try {
      setBusy(true)
      await addWeightEntry({
        weightKg,
        comparable: weightComparable,
        exceptionNote: weightComparable ? null : weightNote || 'Medición fuera del protocolo habitual',
        notes: weightNote,
      })
      setWeightValue('')
      setWeightNote('')
      setWeightComparable(true)
      setMessage('Peso guardado.')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se ha podido guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleBodySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    try {
      setBusy(true)
      await addBodyMeasurement({
        waistCm: parseOptionalNumber(waist),
        rightArmCm: parseOptionalNumber(rightArm),
        leftArmCm: parseOptionalNumber(leftArm),
        notes: bodyNote,
      })
      setWaist('')
      setRightArm('')
      setLeftArm('')
      setBodyNote('')
      setMessage('Medidas guardadas.')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se han podido guardar las medidas.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFeaturedSave() {
    clearFeedback()

    try {
      setBusy(true)
      await setFeaturedExercises(selectedExercises)
      setMessage('Ejercicios destacados actualizados.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar la selección.')
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    clearFeedback()

    try {
      setBusy(true)
      const result = await exportFenixBackup()
      setMessage(`${result.totalRecords} registros incluidos · ${result.fileName}`)
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === 'AbortError') {
        setMessage('Exportación cancelada.')
      } else {
        setError('No se ha podido generar la copia. Los datos no se han modificado.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleBackupFile(file: File | null) {
    clearFeedback()
    setBackup(null)
    setBackupValidation(null)
    setBackupName(file?.name ?? '')
    setRestoreApproved(false)

    if (!file) {
      return
    }

    try {
      const result = await readAndValidateBackupFile(file)
      setBackup(result.backup)
      setBackupValidation(result.validation)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'No se ha podido leer el backup.')
    }
  }

  async function handleRestore() {
    if (!backup || !restoreApproved) {
      return
    }

    clearFeedback()

    try {
      setBusy(true)
      await restoreFenixBackup(backup)
      window.location.reload()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se ha podido restaurar el backup.')
      setBusy(false)
    }
  }

  if (loading || !summary) {
    return (
      <main className="progress-page">
        <div className="progress-shell">
          <p className="progress-loading">Cargando Progreso…</p>
        </div>
      </main>
    )
  }

  const finalGoal = summary.goals.find((goal) => goal.kind === 'weight_final')
  const milestone = summary.goals.find((goal) => goal.kind === 'weight_milestone')

  return (
    <main className="progress-page">
      <div className="progress-shell">
        <header className="progress-header">
          <div className="progress-header__mark"><PhoenixMark /></div>
          <div>
            <span>FÉNIX</span>
            <h1>PROGRESO</h1>
          </div>
        </header>

        {view === 'summary' ? (
          <>
            <nav className="progress-tabs" aria-label="Secciones de Progreso">
              <button type="button" className="active">Resumen</button>
              <button type="button" onClick={() => setView('weight')}>Peso</button>
              <button type="button" onClick={() => setView('performance')}>Rendimiento</button>
              <button type="button" onClick={() => setView('adherence')}>Adherencia</button>
            </nav>

            {summary.insight ? (
              <section className="progress-insight">
                <span>QUÉ IMPORTA AHORA</span>
                <p>{summary.insight}</p>
              </section>
            ) : null}

            <div className="progress-card-grid">
              <MetricCard
                eyebrow="PESO"
                title="Tendencia"
                value={
                  summary.weight.currentMean !== null
                    ? formatKg(summary.weight.currentMean)
                    : summary.weight.latest
                      ? formatKg(summary.weight.latest.weightKg)
                      : 'Sin datos'
                }
                detail={
                  summary.weight.status === 'ready' && summary.weight.deltaKg !== null
                    ? `${summary.weight.deltaKg >= 0 ? '+' : ''}${summary.weight.deltaKg.toLocaleString('es-ES')} kg vs. 7 días anteriores`
                    : 'Tendencia: datos insuficientes'
                }
                onClick={() => setView('weight')}
              />

              <MetricCard
                eyebrow="ADHERENCIA"
                title="Rutina · 7 días"
                value={
                  summary.routine.adherencePercent === null
                    ? 'Sin datos'
                    : `${summary.routine.adherencePercent}%`
                }
                detail={`${summary.routine.completed} completadas · ${summary.routine.skipped} omitidas · ${summary.routine.unregistered} sin registrar`}
                onClick={() => setView('adherence')}
              />

              <MetricCard
                eyebrow="RENDIMIENTO"
                title="Ejercicios clave"
                value={performance.length > 0 ? `${performance.length} seguidos` : 'Sin selección'}
                detail="Training define qué ejecuciones son comparables."
                onClick={() => setView('performance')}
              />

              <MetricCard
                eyebrow="CUERPO"
                title="Medidas"
                value={measurements.length > 0 ? formatDate(measurements[0].date) : 'Sin datos'}
                detail="Cintura y brazos · seguimiento aproximadamente mensual."
                onClick={() => setView('body')}
              />
            </div>

            <section className="progress-goals-card">
              <span className="progress-eyebrow">OBJETIVOS VIGENTES</span>
              <div>
                <p>Hito activo</p>
                <strong>{milestone ? formatKg(milestone.targetWeightKg) : '—'}</strong>
                <small>{milestone?.targetPeriodLabel ?? 'Sin periodo definido'}</small>
              </div>
              <div>
                <p>Objetivo final</p>
                <strong>{finalGoal ? formatKg(finalGoal.targetWeightKg) : '—'}</strong>
                <small>Sin barra lineal: importa la tendencia, no un porcentaje arbitrario.</small>
              </div>
            </section>

            <button type="button" className="progress-data-link" onClick={() => setView('data')}>
              Seguridad y copias de datos <span aria-hidden="true">›</span>
            </button>
          </>
        ) : null}

        {view === 'weight' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-detail-heading">
              <span className="progress-eyebrow">PESO</span>
              <h2>Dirección sostenida</h2>
              <p>Los cambios diarios se conservan, pero la señal principal es la tendencia.</p>
            </section>

            <section className="progress-weight-hero">
              <div>
                <span>MEDIA RECIENTE</span>
                <strong>{summary.weight.currentMean !== null ? formatKg(summary.weight.currentMean) : 'Datos insuficientes'}</strong>
                <p>
                  {summary.weight.status === 'ready' && summary.weight.deltaKg !== null
                    ? `${summary.weight.deltaKg >= 0 ? '+' : ''}${summary.weight.deltaKg.toLocaleString('es-ES')} kg frente al periodo anterior`
                    : `${summary.weight.currentCount}/3 registros comparables en los últimos 7 días`}
                </p>
              </div>
              <WeightChart entries={summary.weight.series} />
            </section>

            <form className="progress-form" onSubmit={handleWeightSubmit}>
              <span className="progress-eyebrow">REGISTRO RÁPIDO</span>
              <label>
                <span>Peso (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.1"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  placeholder="65,8"
                />
              </label>
              <label className="progress-check-row">
                <input
                  type="checkbox"
                  checked={weightComparable}
                  onChange={(event) => setWeightComparable(event.target.checked)}
                />
                <span>Medición comparable con el protocolo habitual</span>
              </label>
              <label>
                <span>Nota opcional</span>
                <input
                  type="text"
                  value={weightNote}
                  onChange={(event) => setWeightNote(event.target.value)}
                  placeholder={weightComparable ? 'Opcional' : 'Ej. tarde, después de comer…'}
                />
              </label>
              <button type="submit" className="progress-primary-button" disabled={busy}>
                Guardar peso
              </button>
            </form>

            <section className="progress-history-card">
              <div className="progress-section-title">
                <h3>Historial</h3>
                <span>{weightHistory.length} registros</span>
              </div>
              {weightHistory.length === 0 ? (
                <p className="progress-empty">Todavía no hay pesos registrados.</p>
              ) : (
                weightHistory.slice(0, 12).map((entry) => (
                  <div className="progress-history-row" key={entry.id}>
                    <div>
                      <strong>{formatKg(entry.weightKg)}</strong>
                      <span>{formatDate(entry.date)} · {entry.comparable ? 'Comparable' : 'Excepcional'}</span>
                    </div>
                    {pendingWeightDelete === entry.id ? (
                      <div className="progress-inline-confirm">
                        <button
                          type="button"
                          onClick={() => {
                            void deleteWeightEntry(entry.id).then(async () => {
                              setPendingWeightDelete(null)
                              await load()
                            })
                          }}
                        >
                          Confirmar
                        </button>
                        <button type="button" onClick={() => setPendingWeightDelete(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" className="progress-text-button" onClick={() => setPendingWeightDelete(entry.id)}>
                        Corregir
                      </button>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}

        {view === 'adherence' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-detail-heading">
              <span className="progress-eyebrow">ADHERENCIA</span>
              <h2>Consistencia sin castigar datos ausentes</h2>
              <p>“Sin registrar” reduce cobertura; no equivale a incumplimiento.</p>
            </section>

            <section className="progress-adherence-card">
              <div className="progress-section-title">
                <h3>Rutina · últimos 7 días</h3>
                <strong>{summary.routine.adherencePercent === null ? '—' : `${summary.routine.adherencePercent}%`}</strong>
              </div>
              <div className="progress-stat-grid">
                <div><strong>{summary.routine.completed}</strong><span>Completadas</span></div>
                <div><strong>{summary.routine.skipped}</strong><span>Omitidas</span></div>
                <div><strong>{summary.routine.unregistered}</strong><span>Sin registrar</span></div>
                <div><strong>{summary.routine.notApplicable}</strong><span>No aplica</span></div>
              </div>
              <p>Denominador conocido: completadas + omitidas. Los días sin información no se convierten en fallos.</p>
            </section>

            <section className="progress-adherence-card">
              <div className="progress-section-title">
                <h3>Training · últimas 4 semanas</h3>
                <strong>{summary.training.adherencePercent === null ? '—' : `${summary.training.adherencePercent}%`}</strong>
              </div>
              <div className="progress-stat-grid">
                <div><strong>{summary.training.completed}</strong><span>Completadas</span></div>
                <div><strong>{summary.training.incomplete}</strong><span>Incompletas</span></div>
                <div><strong>{summary.training.omitted}</strong><span>Omitidas</span></div>
                <div><strong>{summary.training.unresolved}</strong><span>Pendientes</span></div>
              </div>
              <p>
                Racha: {summary.training.streakPending ? 'pendiente de confirmar' : `${summary.training.streak} sesiones consecutivas`}.
              </p>
            </section>
          </>
        ) : null}

        {view === 'performance' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-detail-heading">
              <span className="progress-eyebrow">RENDIMIENTO</span>
              <h2>Ejercicios que importan</h2>
              <p>Selecciona hasta cinco. Progreso visualiza; Training conserva la autoridad sobre la comparabilidad.</p>
            </section>

            <section className="progress-performance-card">
              <h3>Ejercicios destacados</h3>
              <div className="progress-exercise-options">
                {exerciseOptions.map((item) => {
                  const checked = selectedExercises.includes(item.exercise.id)
                  const disabled = !checked && selectedExercises.length >= 5

                  return (
                    <label key={item.exercise.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedExercises((current) => [...current, item.exercise.id].slice(0, 5))
                          } else {
                            setSelectedExercises((current) => current.filter((id) => id !== item.exercise.id))
                          }
                        }}
                      />
                      <span>{item.exercise.name}</span>
                    </label>
                  )
                })}
              </div>
              <button type="button" className="progress-primary-button" disabled={busy} onClick={() => void handleFeaturedSave()}>
                Guardar selección
              </button>
            </section>

            <section className="progress-history-card">
              <div className="progress-section-title"><h3>Seguimiento</h3></div>
              {performance.length === 0 ? (
                <p className="progress-empty">Selecciona ejercicios para construir esta vista.</p>
              ) : (
                performance.map((item) => (
                  <div className="progress-performance-row" key={item.exercise?.id}>
                    <div>
                      <strong>{item.exercise?.name}</strong>
                      <span>
                        {item.latestSet
                          ? `${item.latestSet.weight ?? '—'} kg · ${item.latestSet.reps ?? '—'} reps · RIR ${item.latestSet.rir ?? '—'}`
                          : 'Sin ejecución histórica válida'}
                      </span>
                    </div>
                    <small>Sin comparación válida</small>
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}

        {view === 'body' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-detail-heading">
              <span className="progress-eyebrow">CUERPO</span>
              <h2>Medidas comparables</h2>
              <p>Cintura y brazos, aproximadamente una vez al mes y evitando el post-entreno cuando sea posible.</p>
            </section>

            <form className="progress-form" onSubmit={handleBodySubmit}>
              <div className="progress-three-columns">
                <label><span>Cintura</span><input type="number" inputMode="decimal" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="cm" /></label>
                <label><span>Brazo der.</span><input type="number" inputMode="decimal" step="0.1" value={rightArm} onChange={(e) => setRightArm(e.target.value)} placeholder="cm" /></label>
                <label><span>Brazo izq.</span><input type="number" inputMode="decimal" step="0.1" value={leftArm} onChange={(e) => setLeftArm(e.target.value)} placeholder="cm" /></label>
              </div>
              <label><span>Nota opcional</span><input type="text" value={bodyNote} onChange={(e) => setBodyNote(e.target.value)} /></label>
              <button type="submit" className="progress-primary-button" disabled={busy}>Guardar medidas</button>
            </form>

            <section className="progress-history-card">
              <div className="progress-section-title"><h3>Historial</h3><span>{measurements.length} registros</span></div>
              {measurements.length === 0 ? (
                <p className="progress-empty">La primera medición será tu línea base.</p>
              ) : (
                measurements.map((item) => (
                  <div className="progress-body-row" key={item.id}>
                    <div>
                      <strong>{formatDate(item.date)}</strong>
                      <span>Cintura {formatCm(item.waistCm)} · D {formatCm(item.rightArmCm)} · I {formatCm(item.leftArmCm)}</span>
                    </div>
                    {pendingBodyDelete === item.id ? (
                      <div className="progress-inline-confirm">
                        <button type="button" onClick={() => void deleteBodyMeasurement(item.id).then(async () => { setPendingBodyDelete(null); await load() })}>Confirmar</button>
                        <button type="button" onClick={() => setPendingBodyDelete(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" className="progress-text-button" onClick={() => setPendingBodyDelete(item.id)}>Corregir</button>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}

        {view === 'data' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-detail-heading">
              <span className="progress-eyebrow">DATOS</span>
              <h2>Backup y recuperación</h2>
              <p>El backup es independiente del código y contiene la base local completa de este dispositivo.</p>
            </section>

            <section className="progress-data-card">
              <h3>Exportar copia completa</h3>
              <p>No modifica ningún dato.</p>
              <button type="button" className="progress-primary-button" disabled={busy} onClick={() => void handleExport()}>
                Exportar backup JSON
              </button>
            </section>

            <section className="progress-data-card progress-data-card--danger">
              <h3>Validar y restaurar</h3>
              <p>La restauración reemplaza la base local del dispositivo. Primero se valida formato, recuentos, duplicados y referencias.</p>
              <label className="progress-file-picker">
                <span>Seleccionar backup JSON</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void handleBackupFile(event.target.files?.[0] ?? null)}
                />
              </label>

              {backupValidation ? (
                <div className={backupValidation.valid ? 'progress-validation progress-validation--ok' : 'progress-validation progress-validation--error'}>
                  <strong>{backupValidation.valid ? 'Backup válido' : 'Backup no válido'}</strong>
                  <span>{backupName}</span>
                  <p>Esquema v{backupValidation.schemaVersion ?? '—'} · {backupValidation.totalRecords ?? '—'} registros</p>
                  {backupValidation.warnings.map((warning) => <p key={warning}>Aviso: {warning}</p>)}
                  {backupValidation.errors.map((validationError) => <p key={validationError}>{validationError}</p>)}
                </div>
              ) : null}

              {backupValidation?.valid && backup ? (
                <>
                  <label className="progress-check-row progress-restore-check">
                    <input type="checkbox" checked={restoreApproved} onChange={(event) => setRestoreApproved(event.target.checked)} />
                    <span>Entiendo que este backup reemplazará los datos locales actuales de este dispositivo.</span>
                  </label>
                  <button
                    type="button"
                    className="progress-danger-button"
                    disabled={busy || !restoreApproved}
                    onClick={() => void handleRestore()}
                  >
                    Restaurar este backup
                  </button>
                </>
              ) : null}
            </section>
          </>
        ) : null}

        {message ? <p className="progress-feedback progress-feedback--success">{message}</p> : null}
        {error ? <p className="progress-feedback progress-feedback--error">{error}</p> : null}
      </div>
    </main>
  )
}
