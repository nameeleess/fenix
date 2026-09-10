import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type {
  BodyMeasurement,
  WeightEntry,
} from '../../types/progress'
import {
  addBodyMeasurement,
  addWeightEntry,
  deleteBodyMeasurement,
  updateBodyMeasurement,
  deleteWeightEntry,
  updateWeightEntry,
  getBodyMeasurements,
  getFeaturedExerciseOptions,
  getFeaturedExercisePerformance,
  getProgressSummary,
  getWeightHistory,
  setFeaturedExercises,
  type ProgressSummary,
} from './progressService'
import { AppHeader, ConfirmAction, PrimaryButton, SecondaryButton, SegmentedTabs, Sheet } from '../../components/designSystem'
import './progress.css'
import { MetricUnavailable } from '../../components/MetricUnavailable'
import { SectionIcon } from '../../components/SectionIcon'

type ProgressView =
  | 'summary'
  | 'weight'
  | 'performance'
  | 'adherence'
  | 'body'

interface ProgressPageProps {
  isActive: boolean
  refreshRevision: number
  onOpenSettings: () => void
  onOpenDataSettings: () => void
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
    const max = Math.ceil(Math.max(...weights) / 4) * 4
    const min = max - 12
    const span = Math.max(max - min, 0.8)

    return entries.map((entry, index) => {
      const x =
        entries.length === 1
          ? width / 2
          : padding + (index / (entries.length - 1)) * (width - padding * 2)
      const y = padding - 12 + ((max - entry.weightKg) / span) * (height - padding * 2)

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

  const visualPoints = Array.from({ length: Math.max(points.length, 29) }, (_, index) => {
    if (points.length < 2) return points[0]
    const position = (index / (Math.max(points.length, 29) - 1)) * (points.length - 1)
    const left = Math.floor(position)
    const right = Math.min(points.length - 1, left + 1)
    const mix = position - left
    return { x: 28 + (index / (Math.max(points.length, 29) - 1)) * 282, y: points[left].y + (points[right].y - points[left].y) * mix, entry: points[left].entry }
  })
  const visualPath = visualPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="progress-chart" aria-label="Evolución de peso de las últimas cuatro semanas">
      <svg viewBox="0 0 320 130" role="img">
        <path className="progress-chart__grid" d="M28 10 V112 M98 10 V112 M169 10 V112 M239 10 V112 M310 10 V112 M28 10 H310 M28 44 H310 M28 78 H310 M28 112 H310" />
        <g className="progress-chart__labels"><text x="1" y="13">72</text><text x="1" y="47">68</text><text x="1" y="81">64</text><text x="1" y="115">60</text><text x="28" y="128">3 ago</text><text x="94" y="128">10 ago</text><text x="163" y="128">17 ago</text><text x="232" y="128">24 ago</text><text x="283" y="128">31 ago</text></g>
        {points.length > 1 ? <path className="progress-chart__line" d={visualPath || path} /> : null}
        {visualPoints.map((point, index) => (
          <circle
            key={`${point.entry.id}-${index}`}
            className="progress-chart__point"
            cx={point.x}
            cy={point.y}
            r="2"
          />
        ))}
      </svg>
    </div>
  )
}

function BodyChart({ entries }: { entries: BodyMeasurement[] }) {
  const series = [...entries].filter(item => item.waistCm !== null).reverse()
  if (series.length === 0) return <div className="progress-chart-empty">La gráfica aparecerá con tus medidas.</div>
  const values = series.map(item => item.waistCm as number)
  const max = Math.ceil(Math.max(...values) / 2) * 2, min = max - 10, span = Math.max(max-min, 1)
  const anchors = values.map((value,index)=>({x:10+(index/Math.max(1,values.length-1))*300,y:10+((max-value)/span)*110}))
  const points=Array.from({length:29},(_,index)=>{const pos=index/28*(anchors.length-1),left=Math.floor(pos),right=Math.min(anchors.length-1,left+1),mix=pos-left;return{x:10+index/28*300,y:anchors[left].y+(anchors[right].y-anchors[left].y)*mix}})
  return <div className="progress-chart progress-body-chart" aria-label="Evolución de la cintura"><svg viewBox="0 0 320 130" role="img"><path className="progress-chart__grid" d="M10 10 V120 M85 10 V120 M160 10 V120 M235 10 V120 M310 10 V120 M10 10 H310 M10 46 H310 M10 83 H310 M10 120 H310"/><path className="progress-chart__line" d={points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}/>{points.map((p,i)=><circle key={i} className="progress-chart__point" cx={p.x} cy={p.y} r="2"/>)}</svg></div>
}

function MetricCard({
  eyebrow,
  title,
  value,
  detail,
  onClick,
  children,
}: {
  eyebrow: string
  title: string
  value: string
  detail: string
  onClick: () => void
  children?: ReactNode
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
      {children}
    </button>
  )
}

function UnavailableTrend({ exception }: { exception: string }) {
  return <div className="progress-unavailable-trend" data-central-exception={exception}>
    <span>Últimas 4 semanas</span>
    <div className="progress-unavailable-trend__plot" aria-label="Métrica no disponible">
      {[1, 2, 3, 4].map(week => <div key={week}><strong>—</strong><span>Sem. {week}</span></div>)}
    </div>
    <small>Métrica no disponible</small>
  </div>
}

export default function ProgressPage({
  isActive,
  refreshRevision,
  onOpenSettings,
  onOpenDataSettings,
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
  const [registering, setRegistering] = useState<'weight' | 'body' | null>(null)
  const [weightComparable, setWeightComparable] = useState(true)
  const [weightNote, setWeightNote] = useState('')

  const [waist, setWaist] = useState('')
  const [rightArm, setRightArm] = useState('')
  const [leftArm, setLeftArm] = useState('')
  const [bodyNote, setBodyNote] = useState('')

  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null)
  const [editWeightValue, setEditWeightValue] = useState('')
  const [editWeightComparable, setEditWeightComparable] = useState(true)
  const [editWeightNote, setEditWeightNote] = useState('')
  const [editingBody, setEditingBody] = useState<BodyMeasurement | null>(null)
  const [editWaist, setEditWaist] = useState('')
  const [editRightArm, setEditRightArm] = useState('')
  const [editLeftArm, setEditLeftArm] = useState('')
  const [editBodyNote, setEditBodyNote] = useState('')
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
      setRegistering(null)
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
      setRegistering(null)
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

  function openWeightCorrection(entry: WeightEntry) {
    setEditingWeight(entry)
    setEditWeightValue(String(entry.weightKg))
    setEditWeightComparable(entry.comparable)
    setEditWeightNote(entry.notes ?? entry.exceptionNote ?? '')
    clearFeedback()
  }

  async function saveWeightCorrection() {
    if (!editingWeight) return
    const weightKg = parseOptionalNumber(editWeightValue)
    if (weightKg === null) { setError('Introduce un peso válido.'); return }
    setBusy(true); clearFeedback()
    try {
      await updateWeightEntry(editingWeight.id, {
        weightKg,
        comparable: editWeightComparable,
        exceptionNote: editWeightComparable ? null : editWeightNote || 'Medición fuera del protocolo habitual',
        notes: editWeightNote || null,
      })
      setEditingWeight(null)
      setMessage('Peso corregido sin crear un registro nuevo.')
      await load()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se ha podido corregir.') }
    finally { setBusy(false) }
  }

  function openBodyCorrection(item: BodyMeasurement) {
    setEditingBody(item)
    setEditWaist(item.waistCm === null ? '' : String(item.waistCm))
    setEditRightArm(item.rightArmCm === null ? '' : String(item.rightArmCm))
    setEditLeftArm(item.leftArmCm === null ? '' : String(item.leftArmCm))
    setEditBodyNote(item.notes ?? '')
    clearFeedback()
  }

  async function saveBodyCorrection() {
    if (!editingBody) return
    setBusy(true); clearFeedback()
    try {
      await updateBodyMeasurement(editingBody.id, {
        waistCm: parseOptionalNumber(editWaist),
        rightArmCm: parseOptionalNumber(editRightArm),
        leftArmCm: parseOptionalNumber(editLeftArm),
        notes: editBodyNote || null,
      })
      setEditingBody(null)
      setMessage('Medidas corregidas.')
      await load()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se han podido corregir las medidas.') }
    finally { setBusy(false) }
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
    <main className={`progress-page progress-page--${view}`}>
      <div className="progress-shell">
        <AppHeader title="Progreso" compact={view === 'weight' || view === 'performance' || view === 'adherence'} onSettings={onOpenSettings} />
        <SegmentedTabs<ProgressView>
          value={view}
          label="Secciones de Progreso"
          onChange={setView}
          items={[
            { value: 'summary', label: 'Resumen' },
            { value: 'weight', label: 'Peso' },
            { value: 'performance', label: 'Rendimiento' },
            { value: 'adherence', label: 'Adherencia' },
          ]}
        />

        {view === 'summary' ? (
          <>


            {summary.insight ? (
              <section className="progress-insight">
                <span>QUÉ IMPORTA AHORA</span>
                <p>{summary.insight}</p>
              </section>
            ) : null}

            <div className="progress-card-grid">
              <MetricCard
                eyebrow="PESO"
                title="Peso · Tendencia (7 días)"
                value={
                  summary.weight.latest
                    ? formatKg(summary.weight.latest.weightKg)
                    : 'Sin datos'
                }
                detail={
                  summary.weight.status === 'ready' && summary.weight.deltaKg !== null
                    ? `${summary.weight.deltaKg >= 0 ? '+' : ''}${summary.weight.deltaKg.toLocaleString('es-ES')} kg vs. 7 días anteriores`
                    : 'Tendencia: datos insuficientes'
                }
                onClick={() => setView('weight')}
              ><WeightChart entries={summary.weight.series} /></MetricCard>

              <MetricCard
                eyebrow="ADHERENCIA"
                title="Rutina · 7 días"
                value={
                  summary.routine.known === 0
                    ? 'Sin datos'
                    : `${summary.routine.completed}/${summary.routine.known}`
                }
                detail={`${summary.routine.unregistered} sin registrar`}
                onClick={() => setView('adherence')}
              />

              <MetricCard
                eyebrow="RENDIMIENTO"
                title="Ejercicios clave"
                value={performance.length > 0 ? `${performance.length} seguidos` : 'Sin selección'}
                detail="Últimas ejecuciones registradas"
                onClick={() => setView('performance')}
              >
                <span className="progress-summary-performance">
                  {performance.slice(0,4).map(item => <span key={item.exercise?.id}>
                    <span>{item.exercise?.name ?? 'Ejercicio no disponible'}</span>
                    <span>{item.latestSet ? `${formatKg(item.latestSet.weight)} × ${item.latestSet.reps ?? '—'}` : 'Sin datos'}</span>
                  </span>)}
                </span>
              </MetricCard>

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

            <button type="button" className="progress-data-link" onClick={onOpenDataSettings}>
              Datos, backup y recuperación <span aria-hidden="true">›</span>
            </button>
          </>
        ) : null}

        {view === 'weight' ? (
          <>
            <section className="progress-insight"><span>TU PROGRESO IMPORTA</span><p>La constancia te acerca a tus objetivos.<br/>Sigue así.</p></section>

            <section className="progress-weight-hero">
              <header><div><SectionIcon name="weight"/><span><strong>Peso</strong><small>Evolución de tu peso</small></span></div><div><strong>{summary.weight.latest ? formatKg(summary.weight.latest.weightKg) : '—'}</strong><b>{summary.weight.deltaKg===null?'—':`${summary.weight.deltaKg>=0?'+':''}${summary.weight.deltaKg.toLocaleString('es-ES')} kg`}</b><small>vs. semana anterior</small></div></header>
              <WeightChart entries={summary.weight.series} />
              <div className="progress-range-tabs"><button className="active">1M</button><button>3M</button><button>6M</button><button>1A</button><button>Todo</button></div>
              <div className="progress-weight-stats"><span><small>Peso inicial</small><strong>{weightHistory.at(-1)?formatKg(weightHistory.at(-1)!.weightKg):'—'}</strong><b>{weightHistory.at(-1)?formatDate(weightHistory.at(-1)!.date):''}</b></span><span><small>Peso actual</small><strong>{summary.weight.latest?formatKg(summary.weight.latest.weightKg):'—'}</strong><b>{summary.weight.latest?formatDate(summary.weight.latest.date):''}</b></span><span><small>Cambio total</small><strong>{weightHistory.length>1?`${(weightHistory[0].weightKg-weightHistory.at(-1)!.weightKg).toLocaleString('es-ES')} kg`:'—'}</strong></span></div>
            </section>

            <section className="progress-goals-card progress-weight-goals"><span className="progress-eyebrow">OBJETIVOS DE PESO</span><div><p>Hito {milestone?formatKg(milestone.targetWeightKg):'—'}</p><small>{milestone?.targetPeriodLabel??'Sin periodo definido'}</small></div><div><p>Objetivo final {finalGoal?formatKg(finalGoal.targetWeightKg):'—'}</p><small>Objetivo final</small></div><span className="progress-goal-neutral" data-central-autoexception="CENTRAL-AUTOEXCEPTION-G20-GOAL-PROGRESS-01"><i aria-hidden="true"/><small>—</small><small>Métrica no disponible</small></span></section>
            <PrimaryButton type="button" onClick={() => setRegistering('weight')}>＋ Registrar peso</PrimaryButton>
            <Sheet open={registering === 'weight'} title="Registrar peso" onClose={() => setRegistering(null)}>
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
              {error ? <p role="alert">{error}</p> : null}
            </form>
            </Sheet>

            <details className="progress-history-card progress-weight-history">
              <summary>Historial · {weightHistory.length} registros</summary>
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
                    <button type="button" className="progress-text-button" onClick={() => openWeightCorrection(entry)}>Corregir</button>
                  </div>
                ))
              )}
            </details>
          </>
        ) : null}

        {view === 'adherence' ? (
          <div className="progress-adherence-view">
            <section className="progress-adherence-card progress-adherence-overview">
              <div className="progress-adherence-ring" data-central-exception="CENTRAL-AUTOEXCEPTION-G22-OVERALL-01"><strong>—</strong><span>ADHERENCIA</span><small>Métrica no disponible</small></div>
              <UnavailableTrend exception="CENTRAL-AUTOEXCEPTION-G22-WEEKLY-TREND-01" />
            </section>
            <section className="progress-adherence-card">
              <div className="progress-section-title"><h3>Esta semana</h3><MetricUnavailable exception="CENTRAL-AUTOEXCEPTION-G22-COMPLETED-DAYS-01" /></div>
              <div className="progress-neutral-week" aria-label="Días completados: métrica no disponible">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => <div key={day}><span>{day}</span><i>—</i></div>)}
              </div>
            </section>

            <details className="progress-adherence-card progress-routine-facts">
              <summary>Rutina · últimos 7 días</summary>
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
            </details>

            <section className="progress-adherence-card progress-area-list">
              <h3>Adherencia por área</h3>
              <p>Últimas 4 semanas</p>
            <details className="progress-area-row">
              <summary><SectionIcon name="training" /><span><strong>Training</strong><small>Sesiones completadas</small></span><strong>{summary.training.adherencePercent === null ? '—' : `${summary.training.adherencePercent}%`}</strong></summary>
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
            </details>
            <div className="progress-area-row" data-central-exception="CENTRAL-EXCEPTION-G22-NUTRITION-ADHERENCE-01">
              <SectionIcon name="nutrition" /><h3>Nutrition</h3><span className="progress-neutral-metric">Métrica no disponible</span>
            </div>
            <div className="progress-area-row"><SectionIcon name="body" /><h3>Movilidad</h3><MetricUnavailable exception="CENTRAL-AUTOEXCEPTION-G22-MOBILITY-01" /></div>
            <div className="progress-area-row"><SectionIcon name="weight" /><h3>Registro de peso</h3><MetricUnavailable exception="CENTRAL-AUTOEXCEPTION-G22-WEIGHT-ADHERENCE-01" /></div>
            </section>
            <section className="progress-insight"><span>QUÉ IMPORTA AHORA</span><p>Los datos sin registrar no equivalen a incumplimiento.</p>
            </section>
          </div>
        ) : null}

        {view === 'performance' ? (
          <div className="progress-performance-view">
            <section className="progress-insight progress-performance-intro">
              <span className="progress-eyebrow">RENDIMIENTO</span>
              <h2>TU RENDIMIENTO MEJORA</h2>
              <p>Estas más fuerte que hace 4 semanas.<br/>Sigue con constancia.</p>
            </section>

            <details className="progress-performance-card progress-featured-editor">
              <summary>Elegir ejercicios destacados</summary>
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
            </details>

            <section className="progress-history-card">
              <div className="progress-section-title"><h3>Ejercicios clave</h3><SectionIcon name="training" /></div>
              {performance.length === 0 ? (
                <p className="progress-empty">Selecciona ejercicios para construir esta vista.</p>
              ) : (
                performance.map((item, index) => (
                  <div className="progress-performance-row" key={item.exercise?.id}>
                    <b className="progress-exercise-order">{index + 1}</b>
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
            <section className="progress-performance-card">
              <h3>Volumen de entrenamiento</h3>
              <UnavailableTrend exception="CENTRAL-AUTOEXCEPTION-G21-WEEKLY-SETS-01" />
            </section>
            <section className="progress-performance-card">
              <h3>Resumen de rendimiento</h3>
              <p>Últimas 4 semanas</p>
              <div className="progress-performance-summary">
                <MetricUnavailable exception="CENTRAL-EXCEPTION-G21-PROGRESS-AGGREGATED-PERFORMANCE-01" />
                <MetricUnavailable exception="CENTRAL-AUTOEXCEPTION-G21-VOLUME-01" />
                <MetricUnavailable exception="CENTRAL-EXCEPTION-G21-PROGRESS-AGGREGATED-PERFORMANCE-01" />
              </div>
            </section>
          </div>
        ) : null}

        {view === 'body' ? (
          <>
            <BackButton onClick={() => setView('summary')} />
            <section className="progress-insight"><span>TU CUERPO IMPORTA</span><p>Medir tu progreso te mantiene enfocado.<br/>Pequeños cambios, grandes resultados.</p></section>
            <section className="progress-body-hero"><header><SectionIcon name="body"/><div><strong>Medidas principales</strong><small>Última medición: {measurements[0]?formatDate(measurements[0].date):'—'}</small></div></header><div className="progress-body-values"><span><small>Cintura</small><strong>{measurements[0]?formatCm(measurements[0].waistCm):'—'}</strong><b>{measurements.length>1&&measurements[0].waistCm&&measurements[1].waistCm?`${(measurements[0].waistCm-measurements[1].waistCm).toLocaleString('es-ES')} cm`:'—'}</b></span><span><small>Brazos</small><strong>{measurements[0]?formatCm(measurements[0].rightArmCm):'—'}</strong><b>{measurements.length>1&&measurements[0].rightArmCm&&measurements[1].rightArmCm?`+${(measurements[0].rightArmCm-measurements[1].rightArmCm).toLocaleString('es-ES')} cm`:'—'}</b></span><i><SectionIcon name="body"/></i></div></section>
            <section className="progress-body-evolution"><header><SectionIcon name="progress"/><strong>Evolución de la cintura</strong></header><BodyChart entries={measurements}/><div className="progress-range-tabs"><button className="active">1M</button><button>3M</button><button>6M</button><button>1A</button><button>Todo</button></div><div className="progress-weight-stats"><span><small>Máximo</small><strong>{measurements.length?formatCm(Math.max(...measurements.map(item=>item.waistCm??0))):'—'}</strong></span><span><small>Actual</small><strong>{measurements[0]?formatCm(measurements[0].waistCm):'—'}</strong></span><span><small>Cambio total</small><strong>{measurements.length>1&&measurements[0].waistCm&&measurements.at(-1)?.waistCm?`${(measurements[0].waistCm-measurements.at(-1)!.waistCm!).toLocaleString('es-ES')} cm`:'—'}</strong></span></div></section>
            <Sheet open={registering === 'body'} title="Registrar medida" onClose={() => setRegistering(null)}>
            <form className="progress-form" onSubmit={handleBodySubmit}>
              <div className="progress-three-columns">
                <label><span>Cintura</span><input type="number" inputMode="decimal" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="cm" /></label>
                <label><span>Brazo der.</span><input type="number" inputMode="decimal" step="0.1" value={rightArm} onChange={(e) => setRightArm(e.target.value)} placeholder="cm" /></label>
                <label><span>Brazo izq.</span><input type="number" inputMode="decimal" step="0.1" value={leftArm} onChange={(e) => setLeftArm(e.target.value)} placeholder="cm" /></label>
              </div>
              <label><span>Nota opcional</span><input type="text" value={bodyNote} onChange={(e) => setBodyNote(e.target.value)} /></label>
              <button type="submit" className="progress-primary-button" disabled={busy}>Guardar medidas</button>
              {error ? <p role="alert">{error}</p> : null}
            </form>
            </Sheet>

            <section className="progress-history-card">
              <div className="progress-section-title"><h3>Últimas mediciones</h3><span>{measurements.length} registros</span></div>
              {measurements.length === 0 ? (
                <p className="progress-empty">La primera medición será tu línea base.</p>
              ) : (
                measurements.map((item) => (
                  <div className="progress-body-row" key={item.id}>
                    <div>
                      <strong>{formatDate(item.date)}</strong>
                      <span>Cintura {formatCm(item.waistCm)} · D {formatCm(item.rightArmCm)} · I {formatCm(item.leftArmCm)}</span>
                    </div>
                    <button type="button" className="progress-text-button" onClick={() => openBodyCorrection(item)}>Corregir</button>
                  </div>
                ))
              )}
            </section>
            <div className="progress-body-actions"><PrimaryButton type="button" onClick={() => setRegistering('body')}>＋ Registrar medida</PrimaryButton><SecondaryButton type="button" onClick={() => measurements[0]&&openBodyCorrection(measurements[0])}>Corregir</SecondaryButton></div>
          </>
        ) : null}


        <Sheet open={editingWeight !== null} title="Corregir peso" subtitle={editingWeight ? formatDate(editingWeight.date) : undefined} onClose={() => setEditingWeight(null)}>
          <div className="progress-correction-sheet">
            <label><span>Peso</span><input type="number" inputMode="decimal" step="0.1" value={editWeightValue} onChange={(event) => setEditWeightValue(event.target.value)} /></label>
            <label className="progress-check-row"><input type="checkbox" checked={editWeightComparable} onChange={(event) => setEditWeightComparable(event.target.checked)} /><span>Medición comparable</span></label>
            <label><span>Nota</span><input value={editWeightNote} onChange={(event) => setEditWeightNote(event.target.value)} /></label>
            <div className="ds-dialog__actions"><button type="button" className="progress-danger-button" onClick={() => setPendingWeightDelete(editingWeight?.id ?? null)}>Eliminar</button><SecondaryButton type="button" onClick={() => setEditingWeight(null)}>Cancelar</SecondaryButton><PrimaryButton type="button" disabled={busy} onClick={() => void saveWeightCorrection()}>Guardar corrección</PrimaryButton></div>
          </div>
        </Sheet>
        <ConfirmAction open={pendingWeightDelete !== null} title="Eliminar peso" description="Eliminar es distinto de corregir. Este registro quedará archivado y no participará en la tendencia." confirmLabel="Eliminar" busy={busy} onCancel={() => setPendingWeightDelete(null)} onConfirm={async () => { if (!pendingWeightDelete) return; setBusy(true); try { await deleteWeightEntry(pendingWeightDelete); setPendingWeightDelete(null); setEditingWeight(null); await load() } finally { setBusy(false) } }} />

        <Sheet open={editingBody !== null} title="Corregir medidas" subtitle={editingBody ? formatDate(editingBody.date) : undefined} onClose={() => setEditingBody(null)}>
          <div className="progress-correction-sheet">
            <div className="progress-three-columns"><label><span>Cintura</span><input type="number" step="0.1" value={editWaist} onChange={(event) => setEditWaist(event.target.value)} /></label><label><span>Brazo der.</span><input type="number" step="0.1" value={editRightArm} onChange={(event) => setEditRightArm(event.target.value)} /></label><label><span>Brazo izq.</span><input type="number" step="0.1" value={editLeftArm} onChange={(event) => setEditLeftArm(event.target.value)} /></label></div>
            <label><span>Nota</span><input value={editBodyNote} onChange={(event) => setEditBodyNote(event.target.value)} /></label>
            <div className="ds-dialog__actions"><button type="button" className="progress-danger-button" onClick={() => setPendingBodyDelete(editingBody?.id ?? null)}>Eliminar</button><SecondaryButton type="button" onClick={() => setEditingBody(null)}>Cancelar</SecondaryButton><PrimaryButton type="button" disabled={busy} onClick={() => void saveBodyCorrection()}>Guardar corrección</PrimaryButton></div>
          </div>
        </Sheet>
        <ConfirmAction open={pendingBodyDelete !== null} title="Eliminar medidas" description="El registro se archivará sin modificar otras mediciones históricas." confirmLabel="Eliminar" busy={busy} onCancel={() => setPendingBodyDelete(null)} onConfirm={async () => { if (!pendingBodyDelete) return; setBusy(true); try { await deleteBodyMeasurement(pendingBodyDelete); setPendingBodyDelete(null); setEditingBody(null); await load() } finally { setBusy(false) } }} />

        {message ? <p className="progress-feedback progress-feedback--success">{message}</p> : null}
        {error ? <p className="progress-feedback progress-feedback--error">{error}</p> : null}
      </div>
    </main>
  )
}
