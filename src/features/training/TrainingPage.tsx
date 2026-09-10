import {
  useEffect,
  useState,
} from 'react'

import type {
  Exercise,
  ExerciseSet,
  ExerciseTolerance,
  PlannedWorkoutSession,
  WorkoutSessionExercise,
} from '../../types/training'

import {
  addExerciseSet,
  discardEmptyWorkout,
  finishWorkout,
  getActiveWorkout,
  getExerciseAlternatives,
  getExerciseCatalog,
  getTrainingHome,
  getTrainingTemplates,
  getWorkoutHistory,
  omitPlannedWorkout,
  removeExerciseSet,
  reprogramPlannedWorkout,
  saveSetDraft,
  startPlannedWorkout,
  startRestTimer,
  startTemplateWorkout,
  stopRestTimer,
  substituteSessionExercise,
  toggleSetCompletion,
  updateExercisePersonalContext,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  duplicateWorkoutTemplate,
  archiveWorkoutTemplate,
  createCustomExercise,
  updateCustomExercise,
  archiveCustomExercise,
  isSystemExercise,
  type WorkoutTemplateDraft,
  type WorkoutTemplateExerciseInput,
  type CustomExerciseDraft,
  type ActiveSessionView,
  type HistorySessionView,
  type SetValues,
  type TrainingHomeView,
  type TrainingTemplateView,
} from './trainingService'

import { AppHeader, ConfirmAction, Dialog, EmptyState, PrimaryButton, SecondaryButton, SegmentedTabs, Sheet, StatusBadge, WeekDaySelector } from '../../components/designSystem'
import { getLocalDateKey as getSharedLocalDateKey } from '../../utils/date'

import {
  ExerciseVisual,
  RoutineMuscleMap,
  ExerciseMuscleMap,
} from './TrainingVisuals'

import './training.css'
import './training-session.css'
import { SectionIcon } from '../../components/SectionIcon'
import { createUuid } from '../../utils/uuid'

type TrainingTab =
  | 'home'
  | 'routines'
  | 'exercises'
  | 'history'

const TRAINING_TABS = [{ value:'home' as const,label:'Hoy' },{ value:'routines' as const,label:'Rutinas' },{ value:'exercises' as const,label:'Ejercicios' },{ value:'history' as const,label:'Historial' }]
function featuredExerciseIcon(name: string) {
  const normalized = name.toLocaleLowerCase('es-ES')
  if (normalized.includes('prensa de piernas')) return 'exercise-leg-press'
  if (normalized.includes('extensión de cuádriceps')) return 'exercise-leg-extension'
  if (normalized.includes('curl femoral')) return 'exercise-leg-curl'
  if (normalized.includes('hip thrust')) return 'exercise-hip-thrust'
  return 'training'
}
function routineSummaryDescription(name: string, fallback: string | null) {
  const normalized = name.toLocaleLowerCase('es-ES')
  if (normalized === 'upper a') return 'Pecho · Espalda · Hombros'
  if (normalized === 'lower a' || normalized === 'lower b') return 'Piernas · Glúteos · Core'
  if (normalized === 'upper b') return 'Pecho · Espalda · Brazos'
  if (normalized.includes('movilidad')) return 'Movilidad · Flexibilidad'
  return fallback || 'Rutina de Training preparada para futuras sesiones.'
}
function routineSummaryDuration(name: string, minutes: number | null | undefined) {
  return name.toLocaleLowerCase('es-ES').includes('movilidad')
    ? '10–15 min'
    : `${minutes ?? '—'} min`
}
function TrainingOverlayHeader({ onClose, onTabChange, tab, subtitle, editor = false }: { onClose: () => void; onTabChange?: (tab: TrainingTab) => void; tab?: TrainingTab; subtitle: string; editor?: boolean }) {
  return <div className="training-overlay-header"><AppHeader title="Training" subtitle={editor ? undefined : subtitle} dateKey={editor ? getSharedLocalDateKey() : undefined} back={editor && tab === 'exercises' ? undefined : { label:'Cerrar',onClick:onClose }} />{editor && tab ? <SegmentedTabs value={tab} items={TRAINING_TABS} label="Secciones de Training" onChange={next => { onClose(); onTabChange?.(next) }} /> : null}{editor && tab === 'exercises' ? <div className="training-overlay-editor-title"><button type="button" aria-label="Cerrar" onClick={onClose}>‹</button><h2>Crear / Editar ejercicio</h2></div> : null}</div>
}

interface TrainingPageProps {
  isActive: boolean
  refreshRevision: number
  onOpenSettings: () => void
}

interface TrainingData {
  active: ActiveSessionView | null
  home: TrainingHomeView
  templates: TrainingTemplateView[]
  history: HistorySessionView[]
  exercises: Exercise[]
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day, 12))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRest(seconds: number) {
  if (seconds <= 0) {
    return 'sin pausa fija'
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return rest === 0
    ? `${minutes} min`
    : `${minutes}:${String(rest).padStart(2, '0')} min`
}

function statusLabel(status: PlannedWorkoutSession['status']) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completada'
  if (status === 'incomplete') return 'Incompleta'
  return 'Omitida'
}

function statusClass(status: PlannedWorkoutSession['status']) {
  if (status === 'completed') return 'is-success'
  if (status === 'incomplete' || status === 'omitted') return 'is-danger'
  if (status === 'in_progress') return 'is-active'
  return 'is-pending'
}

function SetRow({
  set,
  targetRir,
  simpleText = null,
  onChanged,
  onCompleted,
}: {
  set: ExerciseSet
  targetRir: string
  simpleText?: string | null
  onChanged: () => Promise<void>
  onCompleted: (seconds: number) => Promise<void>
}) {
  const [weight, setWeight] = useState(set.weight?.toString() ?? '')
  const [reps, setReps] = useState(set.reps?.toString() ?? '')
  const [rir, setRir] = useState(set.rir?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function values(): SetValues {
    return {
      weight: weight.trim() === '' ? null : Number(weight),
      reps: reps.trim() === '' ? null : Number(reps),
      rir:
        set.setType === 'warmup' || rir.trim() === ''
          ? null
          : Number(rir),
    }
  }

  async function save() {
    try {
      await saveSetDraft(set.id, values())
      setError('')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se ha podido guardar la serie.',
      )
    }
  }

  async function toggle() {
    setBusy(true)

    try {
      const result = await toggleSetCompletion(set.id, values())
      setError('')

      if (result.completed && result.restSeconds > 0) {
        await onCompleted(result.restSeconds)
      }

      await onChanged()
    } catch (toggleError: unknown) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : 'No se ha podido actualizar la serie.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (set.completedAt !== null) {
      setError('Desmarca la serie antes de eliminarla.')
      return
    }

    await removeExerciseSet(set.id)
    await onChanged()
  }

  return (
    <div
      className={`training-set-row ${set.completedAt ? 'is-completed' : ''} ${set.setType === 'warmup' ? 'is-warmup' : ''} ${simpleText ? 'is-simple' : ''}`}
    >
      <div className="training-set-row__index">
        <details><summary aria-label={`Opciones de serie ${set.setType === 'warmup' ? 'W' : ''}${set.order}`}>{set.setType === 'warmup' ? `W${set.order}` : set.order}</summary>
          <button type="button" className="training-set-row__remove" aria-label="Eliminar serie" onClick={() => void remove()}>Eliminar serie</button>
        </details>
      </div>

      {simpleText ? (
        <div className="training-set-row__simple">
          <span>OBJETIVO</span>
          <strong>{simpleText}</strong>
        </div>
      ) : (
        <>
          <label>
            <span>kg</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              onBlur={() => void save()}
            />
          </label>

          <label>
            <span>Reps</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              onBlur={() => void save()}
            />
          </label>

          <label>
            <span>{set.setType === 'warmup' ? 'RIR —' : `RIR ${targetRir}`}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10"
              step="0.5"
              value={set.setType === 'warmup' ? '' : rir}
              disabled={set.setType === 'warmup'}
              placeholder={set.setType === 'warmup' ? '—' : targetRir}
              onChange={(event) => setRir(event.target.value)}
              onBlur={() => void save()}
            />
          </label>
        </>
      )}

      <button
        type="button"
        className="training-set-row__complete"
        disabled={busy}
        aria-label={set.completedAt ? 'Desmarcar serie' : 'Completar serie'}
        onClick={() => void toggle()}
      >
        {set.completedAt ? '✓' : '○'}
      </button>

      {error ? <p className="training-inline-error">{error}</p> : null}
    </div>
  )
}

function RestTimer({
  endsAt,
  onStop,
}: {
  endsAt: string | null
  onStop: () => Promise<void>
}) {
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    if (!endsAt) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setClock(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [endsAt])

  if (!endsAt) {
    return null
  }

  const remaining = Math.max(0, Math.ceil((Date.parse(endsAt) - clock) / 1000))
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className={`training-rest-timer ${remaining === 0 ? 'is-done' : ''}`}>
      <span className="training-rest-timer__icon"><SectionIcon name="clock" /></span>
      <div>
        <span>Descanso</span>
        <strong>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} <small>restante</small></strong>
      </div>
      <button type="button" onClick={() => void onStop()}>
        Saltar descanso
      </button>
    </div>
  )
}

function ActiveTraining({
  view,
  onReload,
  onExit,
}: {
  view: ActiveSessionView
  onReload: () => Promise<void>
  onExit: () => void
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [finishOpen, setFinishOpen] = useState(false)
  const [substituteOpen, setSubstituteOpen] = useState(false)
  const [alternatives, setAlternatives] = useState<Exercise[]>([])
  const [selectedAlternative, setSelectedAlternative] = useState('')
  const [updateRoutine, setUpdateRoutine] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const boundedIndex = Math.min(
    exerciseIndex,
    Math.max(view.exercises.length - 1, 0),
  )
  const item = view.exercises[boundedIndex]

  async function completeSet(seconds: number) {
    if (seconds <= 0) {
      return
    }

    await startRestTimer(view.session.id, seconds)
  }

  async function stopTimer() {
    await stopRestTimer(view.session.id)
    await onReload()
  }

  async function openSubstitute(snapshot: WorkoutSessionExercise) {
    const options = await getExerciseAlternatives(snapshot)
    setAlternatives(options)
    setSelectedAlternative(options[0]?.id ?? '')
    setUpdateRoutine(false)
    setSubstituteOpen(true)
  }

  async function confirmSubstitution() {
    if (!item || selectedAlternative === '') {
      return
    }

    setBusy(true)

    try {
      await substituteSessionExercise(
        item.snapshot.id,
        selectedAlternative,
        updateRoutine,
      )
      setSubstituteOpen(false)
      setError('')
      await onReload()
    } catch (substitutionError: unknown) {
      setError(
        substitutionError instanceof Error
          ? substitutionError.message
          : 'No se ha podido sustituir el ejercicio.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function finalize(result: 'completed' | 'incomplete') {
    setBusy(true)

    try {
      await finishWorkout(view.session.id, result)
      setFinishOpen(false)
      setError('')
      await onReload()
      onExit()
    } catch (finishError: unknown) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : 'No se ha podido finalizar la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function discard() {
    setBusy(true)

    try {
      await discardEmptyWorkout(view.session.id)
      setFinishOpen(false)
      setError('')
      await onReload()
      onExit()
    } catch (discardError: unknown) {
      setError(
        discardError instanceof Error
          ? discardError.message
          : 'No se ha podido descartar la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!item) {
    return (
      <main className="training-page">
        <p>No hay ejercicios disponibles en esta sesión.</p>
      </main>
    )
  }

  const targetRir =
    item.snapshot.targetRirMin === item.snapshot.targetRirMax
      ? `${item.snapshot.targetRirMin ?? '—'}`
      : `${item.snapshot.targetRirMin ?? '—'}–${item.snapshot.targetRirMax ?? '—'}`

  const previousText = item.previousSets.length > 0
    ? item.previousSets
        .map(
          (set) =>
            `${set.weight ?? '—'} kg × ${set.reps ?? '—'} · RIR ${set.rir ?? '—'}`,
        )
        .join(' · ')
    : 'Sin referencia comparable todavía.'

  const warmups = item.sets.filter((set) => set.setType === 'warmup')
  const working = item.sets.filter((set) => set.setType === 'working')
  const isGuidedSession = view.template.isFormalStrength === false
  const completedExerciseCount = view.exercises.filter((exercise) =>
    exercise.sets.some((set) => set.setType === 'working' && set.completedAt !== null),
  ).length
  const simpleTarget = item.snapshot.targetSeconds
    ? `${item.snapshot.targetSeconds} s`
    : `${item.snapshot.minReps}–${item.snapshot.maxReps} repeticiones`

  return (
    <main className="training-page training-page--active">
      <div className="training-active-header">
        <AppHeader title={view.template.name} kicker="TRAINING · EN CURSO" back={{label:'Volver a Training',onClick:onExit}}
          subtitle={isGuidedSession
            ? `${view.completedWorkingSets}/${view.totalWorkingSets} pasos completados · ${Math.max(0, Math.floor((clock - Date.parse(view.session.startedAt)) / 60000))} min`
            : `${completedExerciseCount}/${view.exercises.length} ejercicios · ${Math.max(0, Math.floor((clock - Date.parse(view.session.startedAt)) / 60000))} min`}
          action={<button
          type="button"
          className="training-finish-shortcut"
          onClick={() => setFinishOpen(true)}
        >
          Finalizar
        </button>} />
      </div>

      <section className="training-current-card">
        <div className="training-current-card__top">
          <div>
            <h2><span className="training-current-number">{boundedIndex + 1}</span>{item.exercise.name}</h2>
            {isGuidedSession ? <p>
              {isGuidedSession
                ? `${item.snapshot.targetSets} × ${simpleTarget}`
                : `${item.snapshot.targetSets} × ${item.snapshot.minReps}–${item.snapshot.maxReps} · RIR ${targetRir} · ${formatRest(item.snapshot.restSeconds)}`}
            </p> : <div className="training-reference-grid"><p>Última vez: {item.previousSets.length ? `${item.previousSets[0].weight ?? '—'} kg × ${item.previousSets[0].reps ?? '—'} · RIR ${item.previousSets[0].rir ?? '—'}` : 'Sin referencia comparable'}</p><p><span>Sugerencia:</span> {item.previousSets.length ? `${item.previousSets[0].weight ?? '—'} kg · buscar ${(item.previousSets[0].reps ?? item.snapshot.minReps) + 1} reps` : item.progressionHint}</p></div>}
          </div>

          <ExerciseVisual
            guided={isGuidedSession}
            interactive
            exercise={item.exercise}
          />
        </div>

        {!isGuidedSession ? <div className="training-set-table-heading" aria-hidden="true"><span>SERIE</span><span>KG</span><span>REPS</span><span>RIR</span><span>✓</span></div> : null}

        {warmups.length > 0 ? (
          <div className="training-set-section">
            <div className="training-set-section__title">
              <span>CALENTAMIENTO</span>
            </div>

            {warmups.map((set) => (
              <SetRow
                key={`${set.id}-${set.updatedAt}`}
                set={set}
                targetRir="—"
                onChanged={onReload}
                onCompleted={completeSet}
              />
            ))}
          </div>
        ) : null}

        <div className="training-set-section">
          <div className="training-set-section__title">
            <span>{isGuidedSession ? 'MOVIMIENTOS' : 'SERIES DE TRABAJO'}</span>
            {isGuidedSession ? <small>Completa cada paso con control.</small> : null}
          </div>

          {working.map((set) => (
            <SetRow
              key={`${set.id}-${set.updatedAt}`}
              set={set}
              targetRir={targetRir}
              simpleText={isGuidedSession ? simpleTarget : null}
              onChanged={onReload}
              onCompleted={completeSet}
            />
          ))}

        </div>
      </section>

      <RestTimer endsAt={view.restEndsAt} onStop={stopTimer} />

      <section className="training-upcoming-card">
        <span className="training-kicker">Siguientes ejercicios</span>
        <div className="training-upcoming-list">
          {view.exercises.map((exerciseItem, index) => {
            if (index === boundedIndex) return null
            const done = exerciseItem.sets.filter(
              (set) => set.setType === 'working' && set.completedAt !== null,
            ).length
            const total = exerciseItem.sets.filter(
              (set) => set.setType === 'working',
            ).length

            return (
              <button
                key={exerciseItem.snapshot.id}
                type="button"
                className={index === boundedIndex ? 'is-current' : ''}
                onClick={() => setExerciseIndex(index)}
              >
                <SectionIcon name="training" />
                <div>
                  <strong>{index + 1}. {exerciseItem.exercise.name}</strong>
                </div>
                <b>{done === total && total > 0 ? '✓' : '›'}</b>
              </button>
            )
          })}
        </div>
      </section>

      <div className="training-current-actions">
        <button type="button" onClick={() => void openSubstitute(item.snapshot)}>Sustituir ejercicio</button>
        {!isGuidedSession ? <button type="button" onClick={async () => { await addExerciseSet(item.snapshot.id, 'working'); await onReload() }}>+ Añadir serie</button> : null}
        <span data-central-exception="CENTRAL-AUTOEXCEPTION-G07-SESSION-SAVE-01">Guardado automático</span>
      </div>
      <details className="training-session-context"><summary>Técnica y referencias</summary><p>{item.exercise.techniqueNotes}</p><p>{previousText}</p><p>{item.snapshot.targetSets} × {item.snapshot.minReps}–{item.snapshot.maxReps} · RIR {targetRir} · {formatRest(item.snapshot.restSeconds)}</p>
        {boundedIndex > 0 ? <button type="button" onClick={() => setExerciseIndex(boundedIndex - 1)}>← Anterior</button> : null}
        {boundedIndex < view.exercises.length - 1 ? <button type="button" onClick={() => setExerciseIndex(boundedIndex + 1)}>Siguiente →</button> : <button type="button" onClick={() => setFinishOpen(true)}>Finalizar sesión</button>}
      </details>

      {error ? <p className="training-page-error">{error}</p> : null}

      <Dialog
        open={finishOpen}
        title="¿Cómo termina esta sesión?"
        description="Training no finaliza automáticamente. Elige el resultado real para conservar el historial y la racha correctamente."
        onClose={() => setFinishOpen(false)}
      >
        <div className="training-dialog-actions-v21">
          <PrimaryButton type="button" disabled={busy} onClick={() => void finalize('completed')}>Marcar completada</PrimaryButton>
          <SecondaryButton type="button" disabled={busy} onClick={() => void finalize('incomplete')}>Finalizar incompleta</SecondaryButton>
          <button type="button" className="training-danger-button" disabled={busy} onClick={() => void discard()}>Descartar si fue accidental</button>
          <button type="button" className="training-ghost-button" onClick={() => setFinishOpen(false)}>Volver a la sesión</button>
        </div>
      </Dialog>

      <Dialog
        open={substituteOpen}
        title={`Sustituir · ${item.exercise.name}`}
        description="El cambio se aplica a esta sesión. Solo modifica la rutina si lo indicas expresamente."
        onClose={() => setSubstituteOpen(false)}
      >
        <label className="training-field">
          <span>Ejercicio alternativo</span>
          <select value={selectedAlternative} onChange={(event) => setSelectedAlternative(event.target.value)}>
            {alternatives.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.primaryMuscle}</option>
            ))}
          </select>
        </label>
        <label className="training-check-field">
          <input type="checkbox" checked={updateRoutine} onChange={(event) => setUpdateRoutine(event.target.checked)} />
          <span>Actualizar también la rutina futura</span>
        </label>
        <div className="ds-dialog__actions">
          <SecondaryButton type="button" onClick={() => setSubstituteOpen(false)}>Cancelar</SecondaryButton>
          <PrimaryButton type="button" disabled={busy || selectedAlternative === ''} onClick={() => void confirmSubstitution()}>Aplicar sustitución</PrimaryButton>
        </div>
      </Dialog>
    </main>
  )
}

function HomeView({
  home,
  templates,
  selectedDate,
  actualToday,
  onSelectDate,
  onStart,
  onStartTemplate,
  onReprogram,
  onOmit,
}: {
  home: TrainingHomeView
  templates: TrainingTemplateView[]
  selectedDate: string
  actualToday: string
  onSelectDate: (date: string) => void
  onStart: (session: PlannedWorkoutSession) => Promise<void>
  onStartTemplate: (templateId: string) => Promise<void>
  onReprogram: (session: PlannedWorkoutSession) => void
  onOmit: (session: PlannedWorkoutSession) => void
}) {
  const selectedDay = home.week.find((day) => day.date === selectedDate) ?? null
  const focus = selectedDate === actualToday
    ? home.focusSession
    : selectedDay?.sessions[0] ?? null
  const template = focus
    ? templates.find((item) => item.template.id === focus.workoutTemplateId) ?? null
    : null
  const multiSessionDays = home.week.filter((day) => day.sessions.length > 1)

  return (
    <>
      <WeekDaySelector
        actualToday={actualToday}
        selectedDate={selectedDate}
        onSelect={onSelectDate}
        days={home.week.map((day) => ({
          date: day.date,
          state: day.sessions.some((item) => item.status === 'in_progress')
            ? 'active'
            : day.sessions.some((item) => item.status === 'pending')
              ? 'pending'
              : day.sessions.some((item) => item.status === 'incomplete')
                ? 'incomplete'
                : day.sessions.some((item) => item.status === 'omitted')
                  ? 'omitted'
                  : day.sessions.length > 0 && day.sessions.every((item) => item.status === 'completed')
                    ? 'completed'
                    : 'idle',
          badge: day.sessions.length > 1 ? day.sessions.length : null,
        }))}
      />

      {selectedDate !== actualToday ? (
        <div className="training-selected-day-context">
          <span className="training-kicker">FECHA CONSULTADA</span>
          <strong>{formatDate(selectedDate)}</strong>
          <small>Hoy real sigue siendo {formatDate(actualToday)}; racha y pendientes no se reinterpretan.</small>
        </div>
      ) : null}

      {multiSessionDays.length > 0 ? (
        <section className="training-same-day-panel">
          <div className="training-section-heading">
            <div>
              <span className="training-kicker">MÚLTIPLES SESIONES</span>
              <h2>Sesiones que comparten fecha</h2>
            </div>
          </div>

          <div className="training-same-day-list">
            {multiSessionDays.flatMap((day) =>
              day.sessions.map((session) => (
                <article key={session.id} className="training-same-day-session">
                  <div>
                    <span>{formatDate(day.date)}</span>
                    <strong>{session.templateName}</strong>
                    <small className={statusClass(session.status)}>{statusLabel(session.status)}</small>
                  </div>
                  <div className="training-same-day-actions">
                    {(session.status === 'pending' || session.status === 'in_progress') ? (
                      <button type="button" onClick={() => void onStart(session)}>
                        {session.status === 'in_progress' ? 'Reabrir' : 'Iniciar'}
                      </button>
                    ) : null}
                    {session.status === 'pending' ? (
                      <>
                        <button type="button" onClick={() => onReprogram(session)}>Reprogramar</button>
                        <button type="button" onClick={() => onOmit(session)}>Omitir</button>
                      </>
                    ) : null}
                  </div>
                </article>
              )),
            )}
          </div>
        </section>
      ) : null}

      {home.actionableSessions.length > 1 ? (
        <section className="training-session-queue">
          <div className="training-section-heading">
            <div>
              <span className="training-kicker">AGENDA PENDIENTE</span>
              <h2>Otras sesiones disponibles</h2>
            </div>
          </div>

          <div className="training-session-queue__list">
            {home.actionableSessions.slice(1).map((session) => (
              <article key={session.id} className="training-session-queue__item">
                <div>
                  <span>{formatDate(session.scheduledDate)}</span>
                  <strong>{session.templateName}</strong>
                  <small>{statusLabel(session.status)}</small>
                </div>
                <div className="training-same-day-actions">
                  {(session.status === 'pending' || session.status === 'in_progress') ? (
                    <button type="button" onClick={() => void onStart(session)}>
                      {session.status === 'in_progress' ? 'Reabrir' : 'Iniciar'}
                    </button>
                  ) : null}
                  {session.status === 'pending' ? (
                    <>
                      <button type="button" onClick={() => onReprogram(session)}>Reprogramar</button>
                      <button type="button" onClick={() => onOmit(session)}>Omitir</button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {home.unresolvedPast > 0 ? (
        <div className="training-attention-banner">
          <strong>{home.unresolvedPast} sesión pendiente de resolver</strong>
          <span>No se ha marcado como omitida automáticamente.</span>
        </div>
      ) : null}

      {focus && template ? (
        <section className="training-session-hero">
          <div className="training-session-hero__header">
            <div>
              <span className="training-kicker">
                {focus.scheduledDate < actualToday
                  ? 'PENDIENTE ANTERIOR'
                  : focus.scheduledDate === actualToday
                    ? 'HOY'
                    : 'PRÓXIMA SESIÓN'}
              </span>
              <div className="training-session-title"><h2>{focus.templateName}</h2><span className={`training-status-pill ${statusClass(focus.status)}`}>● {statusLabel(focus.status)}</span></div>
              <p>
                <SectionIcon name="calendar" /> {formatDate(focus.scheduledDate)} · <SectionIcon name="clock" /> {focus.estimatedDurationMinutes ?? '—'} min estimados · {template.totalSets} series de trabajo
              </p>
            </div>
            {focus.status === 'pending' ? <details className="training-session-menu"><summary aria-label="Opciones de sesión">···</summary><div><button type="button" onClick={() => onReprogram(focus)}>Reprogramar</button><button type="button" onClick={() => onOmit(focus)}>Omitir sesión</button></div></details> : null}
          </div>

          <div className="training-session-overview">
          <div className="training-session-preview">
            <span className="training-kicker">EJERCICIOS DESTACADOS</span>
            {template.exercises.slice(0, 4).map((item, index) => (
              <div key={item.config.id}>
                <span><SectionIcon name={featuredExerciseIcon(item.exercise.name)} /></span>
                <div>
                  <strong>{index + 1}. {item.exercise.name}</strong>
                  <small>
                    {item.config.targetSets} × {item.config.minReps}–{item.config.maxReps} · RIR {item.config.targetRirMin ?? item.config.targetRir ?? '—'}{item.config.targetRirMax && item.config.targetRirMax !== item.config.targetRirMin ? `–${item.config.targetRirMax}` : ''}
                  </small>
                </div>
              </div>
            ))}
            {template.exercises.length > 4 && (
              <p className="training-session-preview__more">
                + {template.exercises.length - 4} ejercicios más al iniciar la sesión
              </p>
            )}
          </div>
          <RoutineMuscleMap template={template} compact />
          </div>

          {(focus.status === 'pending' || focus.status === 'in_progress') ? (
            <button
              type="button"
              className="training-primary-button"
              onClick={() => void onStart(focus)}
            >
              <SectionIcon name="play" /> {focus.status === 'in_progress' ? 'Reabrir' : 'Iniciar'} {focus.templateName}
            </button>
          ) : null}

        </section>
      ) : (
        <section className="training-empty-card">
          <span className="training-kicker">TRAINING</span>
          <h2>No hay sesión formal pendiente.</h2>
          <p>La programación futura se genera localmente a partir de tus rutinas aprobadas.</p>
        </section>
      )}

      <section className="training-home-grid">
        <article className="training-mini-card">
          <span><SectionIcon name="progress" /> Semana</span>
          <strong>{home.completedThisWeek}/{home.plannedThisWeek}</strong>
          <small>sesiones completadas</small><progress aria-label="Sesiones completadas esta semana" value={home.completedThisWeek} max={Math.max(1,home.plannedThisWeek)} />
        </article>
        <article className="training-mini-card">
          <span><SectionIcon name="energy" /> Racha</span>
          <strong>{home.streakPending ? `${home.streak} · ?` : home.streak} <em>sesiones</em></strong>
          <small>{home.streakPending ? 'pendiente de confirmar' : 'sesiones consecutivas'}</small>
        </article>
      </section>

      <section className="training-secondary-programs">
        <div className="training-section-heading">
          <div>
            <span className="training-kicker">MOVILIDAD & RECOVERY</span>
            <h2>Trabajo complementario</h2>
          </div>
        </div>

        <div className="training-secondary-programs__grid">
          {home.mobilityTemplate ? (
            <article>
              <span>DIARIA · 5–8 MIN</span>
              <h3>{home.mobilityTemplate.template.name}</h3>
              <p>{home.mobilityTemplate.template.description}</p>
              <button
                type="button"
                onClick={() => void onStartTemplate(home.mobilityTemplate!.template.id)}
              >
                Abrir movilidad
              </button>
            </article>
          ) : null}

          {home.recoveryTemplate ? (
            <article>
              <span>MIÉRCOLES · 15–20 MIN</span>
              <h3>{home.recoveryTemplate.template.name}</h3>
              <p>{home.recoveryTemplate.template.description}</p>
              <button
                type="button"
                onClick={() => void onStartTemplate(home.recoveryTemplate!.template.id)}
              >
                Abrir recovery
              </button>
            </article>
          ) : null}
        </div>
      </section>
    </>
  )
}

type RoutineEditorItem = WorkoutTemplateExerciseInput & { clientKey: string }
type RoutineEditorDraft = Omit<WorkoutTemplateDraft, 'exercises'> & { exercises: RoutineEditorItem[] }

function draftFromTemplate(view: TrainingTemplateView): RoutineEditorDraft {
  return {
    name: view.template.name,
    dayOfWeek: view.template.dayOfWeek,
    type: view.template.type,
    description: view.template.description,
    estimatedDurationMinutes: view.template.estimatedDurationMinutes ?? null,
    isFormalStrength: view.template.isFormalStrength ?? false,
    exercises: view.exercises.map(({ config }) => ({
      id: config.id,
      clientKey: config.id,
      exerciseId: config.exerciseId,
      order: config.order,
      targetSets: config.targetSets,
      minReps: config.minReps,
      maxReps: config.maxReps,
      targetRirMin: config.targetRirMin ?? config.targetRir ?? null,
      targetRirMax: config.targetRirMax ?? config.targetRir ?? null,
      restSeconds: config.restSeconds,
      referenceWeight: config.referenceWeight,
      alternativeExerciseIds: config.alternativeExerciseIds ?? [],
      supersetGroupId: config.supersetGroupId ?? null,
      targetSeconds: config.targetSeconds ?? null,
    })),
  }
}

function emptyRoutineDraft(): RoutineEditorDraft {
  return {
    name: '',
    dayOfWeek: null,
    type: 'upper',
    description: null,
    estimatedDurationMinutes: 50,
    isFormalStrength: true,
    exercises: [],
  }
}

function RoutinesView({
  onTabChange,
  home,
  templates,
  exercises,
  onReload,
  onStartTemplate,
  starting,
}: {
  home: TrainingHomeView
  onTabChange: (tab: TrainingTab) => void
  templates: TrainingTemplateView[]
  exercises: Exercise[]
  onReload: () => Promise<void>
  onStartTemplate: (templateId: string) => Promise<void>
  starting: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof emptyRoutineDraft>>(emptyRoutineDraft())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const formal = templates.filter((item) => item.template.isFormalStrength)
  const selected = templates.find((item) => item.template.id === selectedId) ?? null

  function openNew() {
    setDraft(emptyRoutineDraft())
    setEditingId('new')
    setError('')
  }

  function openEdit(view: TrainingTemplateView) {
    setDraft(draftFromTemplate(view))
    setEditingId(view.template.id)
    setError('')
  }

  function patchExercise(clientKey: string, patch: Partial<RoutineEditorItem>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((item) => item.clientKey === clientKey ? { ...item, ...patch } : item),
    }))
  }

  function reorder(clientKey: string, direction: -1 | 1) {
    setDraft((current) => {
      const items = [...current.exercises].sort((a, b) => a.order - b.order)
      const index = items.findIndex((item) => item.clientKey === clientKey)
      const target = index + direction
      if (index < 0 || target < 0 || target >= items.length) return current
      ;[items[index], items[target]] = [items[target], items[index]]
      return { ...current, exercises: items.map((item, itemIndex) => ({ ...item, order: (itemIndex + 1) * 10 })) }
    })
  }

  function addExercise() {
    const first = exercises[0]
    if (!first) return
    setDraft((current) => ({
      ...current,
      exercises: [...current.exercises, {
        clientKey: createUuid(),
        exerciseId: first.id,
        order: (current.exercises.length + 1) * 10,
        targetSets: 3,
        minReps: 6,
        maxReps: 10,
        targetRirMin: 1,
        targetRirMax: 2,
        restSeconds: 120,
        referenceWeight: null,
        alternativeExerciseIds: [],
        supersetGroupId: null,
        targetSeconds: null,
      }],
    }))
  }

  async function save() {
    setBusy(true); setError('')
    try {
      const input: WorkoutTemplateDraft = {
        ...draft,
        exercises: draft.exercises.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}),
          exerciseId: item.exerciseId,
          order: (index + 1) * 10,
          targetSets: Number(item.targetSets),
          minReps: Number(item.minReps),
          maxReps: Number(item.maxReps),
          targetRirMin: item.targetRirMin === null ? null : Number(item.targetRirMin),
          targetRirMax: item.targetRirMax === null ? null : Number(item.targetRirMax),
          restSeconds: Number(item.restSeconds),
          referenceWeight: item.referenceWeight ?? null,
          alternativeExerciseIds: item.alternativeExerciseIds ?? [],
          supersetGroupId: item.supersetGroupId ?? null,
          targetSeconds: item.targetSeconds ?? null,
        })),
      }
      if (editingId === 'new') await createWorkoutTemplate(input)
      else if (editingId) await updateWorkoutTemplate(editingId, input)
      setEditingId(null)
      await onReload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar la rutina.')
    } finally { setBusy(false) }
  }

  async function duplicate(id: string) {
    setBusy(true); setError('')
    try { await duplicateWorkoutTemplate(id); await onReload() }
    catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : 'No se ha podido duplicar.') }
    finally { setBusy(false) }
  }

  async function archive() {
    if (!archiveId) return
    setBusy(true); setError('')
    try { await archiveWorkoutTemplate(archiveId); setArchiveId(null); await onReload() }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : 'No se ha podido archivar.') }
    finally { setBusy(false) }
  }

  return (
    <div className="training-routines-screen">
      <section className="training-week-plan">
        <header><SectionIcon name="calendar" /><div><h2>Plan semanal</h2><p>{formal.filter(item => item.template.dayOfWeek !== null).length} sesiones programadas</p></div><span data-central-exception="CENTRAL-AUTOEXCEPTION-G04-CALENDAR-01">Calendario semanal</span></header>
        <div className="training-week-plan__days">{templates.filter(view => view.template.dayOfWeek !== null && (view.template.isFormalStrength || view.template.type === 'mobility')).sort((a,b) => (a.template.dayOfWeek ?? 0)-(b.template.dayOfWeek ?? 0)).map(view => {
          const day = home.week.find(item => new Date(`${item.date}T12:00:00`).getDay() === view.template.dayOfWeek)
          const completed = day?.sessions.some(item => item.workoutTemplateId === view.template.id && item.status === 'completed')
          const current = day?.date === home.todayKey
          return <button type="button" key={view.template.id} onClick={() => setSelectedId(view.template.id)} className={current ? 'is-current' : ''}><span>{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][view.template.dayOfWeek ?? 0]}</span><strong>{view.template.name}</strong><SectionIcon name={view.template.type === 'lower' ? 'body' : 'training'} /><i aria-label={completed ? 'Completada' : current ? 'Hoy' : 'Programada'}>{completed ? '✓' : current ? '●' : '○'}</i></button>
        })}</div>
      </section>
      <div className="training-section-heading training-section-heading--action"><h2>Rutinas</h2><button type="button" className="training-text-action" onClick={openNew}>Crear rutina ⊕</button></div>
      {error ? <p className="training-page-error" role="alert">{error}</p> : null}
      {formal.length === 0 ? <EmptyState title="Sin rutinas" description="Crea tu primera rutina formal." action={<PrimaryButton onClick={openNew}>Crear rutina</PrimaryButton>} /> : null}
      <div className="training-routines-grid">
        {[...formal, ...templates.filter(view => !view.template.isFormalStrength)].map((view) => (
          <section key={view.template.id} className="training-routine-card training-routine-card--summary">
            <span className="training-routine-icon"><SectionIcon name={view.template.type === 'lower' ? 'body' : view.template.isFormalStrength ? 'training' : 'energy'} /></span>
            <div className="training-routine-card__header"><h2>{view.template.name}</h2><p>{routineSummaryDescription(view.template.name, view.template.description)}</p><small><SectionIcon name="clock" /> {routineSummaryDuration(view.template.name, view.template.estimatedDurationMinutes)} · {view.exercises.length} ejercicios</small></div>
            <RoutineMuscleMap template={view} compact />
            <button
              type="button"
              className="training-routine-open"
              aria-label={view.template.isFormalStrength ? 'Ver detalle' : `Editar ${view.template.name}`}
              onClick={() => view.template.isFormalStrength ? setSelectedId(view.template.id) : openEdit(view)}
            >{view.template.isFormalStrength ? 'Ver' : 'Editar'} <SectionIcon name="chevron" /></button>
            <details className="training-routine-options"><summary aria-label={`Opciones de ${view.template.name}`}>···</summary><div>
              <button type="button" onClick={() => openEdit(view)}>Editar</button>
              <button type="button" onClick={() => void duplicate(view.template.id)} disabled={busy}>Duplicar</button>
              <button type="button" onClick={() => setArchiveId(view.template.id)} disabled={busy}>Archivar</button>
            </div></details>
          </section>
        ))}
      </div>

      <Sheet
        open={selected !== null}
        title={selected?.template.name ?? 'Detalle de rutina'}
        subtitle="Training · detalle de rutina"
        className="training-sheet training-sheet--routine-detail"
        header={<TrainingOverlayHeader subtitle="Detalle de rutina" onClose={() => setSelectedId(null)} />}
        onClose={() => setSelectedId(null)}
      >
        {selected ? (
          <div className="training-routine-detail-v21">
            <section className="training-routine-detail-v21__hero">
              <span className="training-routine-detail-v21__icon"><SectionIcon name="training" /></span>
              <div>
                <span className="training-kicker">RUTINA</span>
                <h2>{selected.template.name}</h2>
                <div className="training-routine-detail-v21__meta">
                  <StatusBadge tone="accent">{selected.template.estimatedDurationMinutes ?? '—'} min</StatusBadge>
                  <StatusBadge>{selected.exercises.length} ejercicios</StatusBadge>
                  <StatusBadge>{selected.totalSets} series</StatusBadge>
                </div>
                <p>{selected.template.description || 'Rutina de Training preparada para futuras sesiones.'}</p>
              </div>
              <RoutineMuscleMap template={selected} />
            </section>

            <section className="training-routine-detail-v21__section">
              <header><span className="training-kicker">EJERCICIOS ({selected.exercises.length})</span><strong>Prescripción</strong></header>
              <div className="training-routine-detail-v21__list">
                {selected.exercises.map((item, index) => (
                  <article key={item.config.id} className="training-routine-detail-v21__exercise">
                    <span className="training-routine-detail-v21__order">{index + 1}</span>
                    <div className="training-routine-detail-v21__exercise-visual">
                      <ExerciseVisual exercise={item.exercise} guided={false} />
                    </div>
                    <div>
                      <strong>{item.exercise.name}</strong>
                      <span>{item.config.targetSets}×{item.config.minReps}–{item.config.maxReps} · RIR {item.config.targetRirMin ?? item.config.targetRir ?? '—'}{item.config.targetRirMax !== null && item.config.targetRirMax !== undefined ? `–${item.config.targetRirMax}` : ''}</span>
                      <small>{formatRest(item.config.restSeconds)}{item.config.supersetGroupId ? ` · Superset ${item.config.supersetGroupId}` : ''}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="training-routine-detail-v21__actions">
              <PrimaryButton
                type="button"
                disabled={starting}
                onClick={() => {
                  const id = selected.template.id
                  setSelectedId(null)
                  void onStartTemplate(id)
                }}
              >
                {starting ? 'Iniciando…' : 'Iniciar rutina'}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  const view = selected
                  setSelectedId(null)
                  openEdit(view)
                }}
              >Editar rutina</SecondaryButton>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet className="training-sheet training-sheet--routine-editor" header={<TrainingOverlayHeader subtitle="Editar rutina" editor tab="routines" onTabChange={onTabChange} onClose={() => setEditingId(null)} />} open={editingId !== null} title={editingId === 'new' ? 'Crear rutina' : 'Editar rutina'} subtitle="Training · futuras sesiones" onClose={() => setEditingId(null)}>
        <div className="training-routine-editor-v21">
          <section className="training-routine-definition"><header><h2>{editingId === 'new' ? 'Crear rutina' : 'Editar rutina'}</h2>{editingId !== 'new' ? <button type="button" disabled data-central-exception="CENTRAL-AUTOEXCEPTION-G10-ROUTINE-DELETE-01">Eliminar rutina</button> : null}</header>
          <label className="training-field"><span>Nombre de la rutina</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <div className="training-editor-grid">
            <label className="training-field"><span>Tipo</span><select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as WorkoutTemplateDraft['type'] }))}><option value="upper">Upper</option><option value="lower">Lower</option><option value="core">Core</option><option value="mobility">Movilidad</option><option value="recovery">Recovery</option></select></label>
            <label className="training-field"><span>Día</span><select value={draft.dayOfWeek ?? ''} onChange={(event) => setDraft((current) => ({ ...current, dayOfWeek: event.target.value === '' ? null : Number(event.target.value) }))}><option value="">Flexible</option><option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option><option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="0">Domingo</option></select></label>
            <label className="training-field"><span>Duración estimada</span><input type="number" min="1" value={draft.estimatedDurationMinutes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, estimatedDurationMinutes: event.target.value === '' ? null : Number(event.target.value) }))} /></label>
          </div>
          </section>
          <div className="training-routine-editor-v21__heading"><span>EJERCICIOS ({draft.exercises.length})</span><span>Orden y prescripción</span></div>
          {draft.exercises.map((item, index) => (
            <details className="training-routine-editor-row" key={item.clientKey}>
              <summary><SectionIcon name="grip" /><strong>{index + 1}</strong>{exercises.find(exercise => exercise.id === item.exerciseId) ? <ExerciseVisual exercise={exercises.find(exercise => exercise.id === item.exerciseId)!} guided={false} /> : null}<span>{exercises.find(exercise => exercise.id === item.exerciseId)?.name ?? 'Seleccionar ejercicio'}<small>{item.targetSets}×{item.minReps}–{item.maxReps} · RIR {item.targetRirMin ?? '—'} · {item.restSeconds} s</small></span><SectionIcon name="chevron" /></summary>
              <div className="training-routine-editor-row__top">
                <strong>{index + 1}</strong>
                <select value={item.exerciseId} onChange={(event) => patchExercise(item.clientKey, { exerciseId: event.target.value })}>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select>
                <button type="button" disabled={index === 0} onClick={() => reorder(item.clientKey, -1)}>↑</button>
                <button type="button" disabled={index === draft.exercises.length - 1} onClick={() => reorder(item.clientKey, 1)}>↓</button>
                <button type="button" aria-label="Retirar ejercicio" onClick={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((candidate) => candidate.clientKey !== item.clientKey) }))}>×</button>
              </div>
              <div className="training-editor-grid training-editor-grid--sets">
                <label><span>Series</span><input type="number" min="1" value={item.targetSets} onChange={(event) => patchExercise(item.clientKey, { targetSets: Number(event.target.value) })} /></label>
                <label><span>Rep min</span><input type="number" min="1" value={item.minReps} onChange={(event) => patchExercise(item.clientKey, { minReps: Number(event.target.value) })} /></label>
                <label><span>Rep max</span><input type="number" min="1" value={item.maxReps} onChange={(event) => patchExercise(item.clientKey, { maxReps: Number(event.target.value) })} /></label>
                <label><span>RIR min</span><input type="number" value={item.targetRirMin ?? ''} onChange={(event) => patchExercise(item.clientKey, { targetRirMin: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                <label><span>RIR max</span><input type="number" value={item.targetRirMax ?? ''} onChange={(event) => patchExercise(item.clientKey, { targetRirMax: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                <label><span>Descanso s</span><input type="number" min="0" value={item.restSeconds} onChange={(event) => patchExercise(item.clientKey, { restSeconds: Number(event.target.value) })} /></label>
              </div>
              <div className="training-editor-grid">
                <label className="training-field"><span>Superset</span><input placeholder="Ej. A" value={item.supersetGroupId ?? ''} onChange={(event) => patchExercise(item.clientKey, { supersetGroupId: event.target.value || null })} /></label>
                <label className="training-field"><span>Alternativa</span><select value={item.alternativeExerciseIds?.[0] ?? ''} onChange={(event) => patchExercise(item.clientKey, { alternativeExerciseIds: event.target.value ? [event.target.value] : [] })}><option value="">Sin alternativa</option>{exercises.filter((exercise) => exercise.id !== item.exerciseId).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
              </div>
            </details>
          ))}
          <button type="button" className="training-add-exercise" onClick={addExercise}>⊕ Añadir ejercicio</button>
          <details className="training-routine-notes"><summary><SectionIcon name="file" /><span>Notas de la rutina<small>{draft.description || 'Ej. Enfocar en técnica y control en la fase excéntrica…'}</small></span><SectionIcon name="chevron" /></summary><label className="training-field"><span>Notas</span><textarea value={draft.description ?? ''} onChange={(event) => setDraft(current => ({...current,description:event.target.value || null}))} /></label></details>
          {error ? <p className="training-page-error" role="alert">{error}</p> : null}
          <PrimaryButton type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar rutina'}</PrimaryButton>
          <div className="ds-dialog__actions"><SecondaryButton type="button" disabled={busy || editingId === 'new'} onClick={() => { if (editingId && editingId !== 'new') void duplicate(editingId) }}>Duplicar rutina</SecondaryButton><button type="button" className="training-unavailable-action" disabled data-central-exception="CENTRAL-EXCEPTION-G10-ROUTINE-EXPORT-01">Exportar <small>No disponible</small></button></div>
          {editingId !== 'new' ? <button type="button" className="training-archive-routine" onClick={() => setArchiveId(editingId)}>Archivar rutina</button> : null}
        </div>
      </Sheet>

      <ConfirmAction open={archiveId !== null} title="Archivar rutina" description="La rutina dejará de estar disponible para nuevas sesiones. Las ejecuciones históricas no se modifican." confirmLabel="Archivar" busy={busy} onCancel={() => setArchiveId(null)} onConfirm={archive} />
    </div>
  )
}

function emptyExerciseDraft(): CustomExerciseDraft {
  return {
    name: '',
    primaryMuscle: '',
    secondaryMuscles: [],
    equipment: '',
    exerciseType: 'isolation',
    tolerance: null,
    personalNotes: null,
    techniqueNotes: null,
    mediaPath: null,
    mediaType: null,
  }
}

function ExercisesView({
  onTabChange,
  history,
  exercises,
  onReload,
}: {
  onTabChange: (tab: TrainingTab) => void
  history: HistorySessionView[]
  exercises: Exercise[]
  onReload: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<CustomExerciseDraft>(emptyExerciseDraft())
  const [tolerance, setTolerance] = useState<ExerciseTolerance | ''>('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [archiveId, setArchiveId] = useState<string | null>(null)

  const muscles = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos']
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const goldenCataloguePriority = ['Press banca', 'Press inclinado con mancuernas', 'Dominadas', 'Remo con pecho apoyado', 'Elevaciones laterales', 'Curl martillo']
  const filtered = exercises.filter((exercise) => {
    const matchesQuery = !normalizedQuery || [exercise.name, exercise.primaryMuscle, exercise.equipment]
      .some((value) => value.toLocaleLowerCase('es').includes(normalizedQuery))
    const groupMuscles: Record<string, string[]> = {
      Pecho: ['Pecho'], Espalda: ['Espalda'], Piernas: ['Piernas', 'Cuádriceps', 'Femoral', 'Glúteos', 'Gemelos'],
      Hombros: ['Hombros'], Brazos: ['Brazos', 'Bíceps', 'Biceps', 'Tríceps', 'Triceps'],
    }
    const matchesFilter = filter === 'all' || (groupMuscles[filter] ?? [filter]).includes(exercise.primaryMuscle)
    return matchesQuery && matchesFilter
  }).sort((a, b) => {
    const ai = goldenCataloguePriority.indexOf(a.name)
    const bi = goldenCataloguePriority.indexOf(b.name)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return a.name.localeCompare(b.name, 'es')
  })
  const selected = exercises.find((item) => item.id === selectedId) ?? null
  const latestSet = selected ? history.flatMap(item => item.sets).filter(set => set.exerciseId === selected.id && set.setType === 'working' && set.completedAt).sort((a,b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0] : null
  const previewName = draft.name.toLocaleLowerCase('es').replace(/ con /g, ' ').trim()
  const previewExercise = exercises.find(exercise => exercise.name.toLocaleLowerCase('es').replace(/ con /g, ' ').trim() === previewName)

  function openDetail(exercise: Exercise) {
    setSelectedId(exercise.id)
    setTolerance(exercise.tolerance ?? '')
    setPersonalNotes(exercise.personalNotes ?? '')
    setError('')
  }

  const catalogueCopy: Record<string, { name: string; meta: string }> = {
    'ex-bench-press': { name: 'Press banca', meta: 'Pecho · Barra' },
    'ex-incline-dumbbell-press': { name: 'Press inclinado', meta: 'Pecho · Barra / Mancuernas' },
    'ex-pull-up': { name: 'Dominadas/Jalón', meta: 'Espalda · Peso corporal / Polea' },
    'ex-chest-supported-row': { name: 'Remo con apoyo', meta: 'Espalda · Mancuernas / Barra' },
    'ex-lateral-raise': { name: 'Elevación lateral', meta: 'Hombros · Mancuernas' },
    'ex-hammer-curl': { name: 'Curl martillo', meta: 'Brazos · Mancuernas' },
  }

  function openCreate() {
    setDraft(emptyExerciseDraft())
    setEditingId('new')
    setError('')
  }

  function openEdit(exercise: Exercise) {
    setDraft({
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
      equipment: exercise.equipment,
      exerciseType: exercise.exerciseType,
      tolerance: exercise.tolerance ?? null,
      personalNotes: exercise.personalNotes ?? null,
      techniqueNotes: exercise.techniqueNotes,
      mediaPath: exercise.mediaPath,
      mediaType: exercise.mediaType,
    })
    setEditingId(exercise.id)
    setError('')
  }

  async function saveContext() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      await updateExercisePersonalContext(selected.id, {
        tolerance: tolerance === '' ? null : tolerance,
        personalNotes: personalNotes.trim() || null,
      })
      await onReload()
      setSelectedId(selected.id)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar.') }
    finally { setBusy(false) }
  }

  async function saveCustom() {
    setBusy(true); setError('')
    try {
      if (editingId === 'new') await createCustomExercise(draft)
      else if (editingId) await updateCustomExercise(editingId, draft)
      setEditingId(null)
      await onReload()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar el ejercicio.') }
    finally { setBusy(false) }
  }

  async function archiveCustom() {
    if (!archiveId) return
    setBusy(true); setError('')
    try { await archiveCustomExercise(archiveId); setArchiveId(null); setSelectedId(null); await onReload() }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : 'No se ha podido archivar.') }
    finally { setBusy(false) }
  }

  return (
    <div className="training-exercises-screen">
      <div className="training-catalog-tools"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Buscar ejercicio…" aria-label="Buscar ejercicio" /></div>
      <div className="training-muscle-filters" role="group" aria-label="Filtrar por músculo"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>{muscles.map(muscle => <button type="button" key={muscle} aria-pressed={filter === muscle} onClick={() => setFilter(muscle)}>{muscle}</button>)}</div>
      <div className="training-catalog-label"><span>Ejercicios ({filtered.length})</span><span aria-label="Orden alfabético">A - Z ↕</span></div>
      {error ? <p className="training-page-error" role="alert">{error}</p> : null}
      <div className="training-exercise-catalog training-exercise-catalog--grid">
        {filtered.map((exercise) => (
          <button key={exercise.id} type="button" className="training-catalog-card training-catalog-card--button" onClick={() => openDetail(exercise)}>
            <ExerciseVisual exercise={exercise} guided={false} />
            <div className="training-catalog-card__heading"><h3>{catalogueCopy[exercise.id]?.name ?? exercise.name}</h3><p>{catalogueCopy[exercise.id]?.meta ?? `${exercise.primaryMuscle} · ${exercise.equipment}`}</p><small>{exercise.exerciseType === 'compound' ? 'Fuerza · Hipertrofia' : exercise.exerciseType === 'isolation' ? 'Aislamiento · Hipertrofia' : 'Movilidad · Control'}</small></div><SectionIcon name="chevron" />
          </button>
        ))}
      </div>
      <button type="button" className="training-create-exercise-after-list" onClick={openCreate}>＋ Crear ejercicio</button>
      {filtered.length === 0 ? <EmptyState title="Sin resultados" description="Prueba otra búsqueda o crea un ejercicio propio." /> : null}

      <Sheet className="training-sheet training-sheet--exercise-detail" header={<TrainingOverlayHeader subtitle="Detalle de ejercicio" onClose={() => setSelectedId(null)} />} open={selected !== null} title={selected?.name ?? 'Ejercicio'} subtitle={selected ? `${selected.primaryMuscle} · ${selected.equipment}` : undefined} onClose={() => setSelectedId(null)}>
        {selected ? <div className="training-exercise-detail-v21">
          <section className="training-exercise-detail-hero">
            <ExerciseVisual key={selected.id} exercise={selected} guided={false} interactive />
            <div className="training-exercise-detail-hero__copy"><h2>{selected.name}</h2><div><StatusBadge tone="accent">{selected.primaryMuscle}</StatusBadge><StatusBadge>{selected.equipment}</StatusBadge></div><p><SectionIcon name="training" /><span>Equipamiento<small>{selected.equipment}</small></span></p><p><SectionIcon name="target" /><span>Objetivo<small>{selected.exerciseType === 'compound' ? 'Fuerza e hipertrofia' : selected.exerciseType === 'isolation' ? 'Aislamiento e hipertrofia' : 'Movilidad y control'}</small></span></p></div>
          </section>
          <section className="training-exercise-last"><span className="training-detail-icon"><SectionIcon name="progress" /></span><div><h3>Último rendimiento</h3>{latestSet ? <><p>Última vez: {latestSet.weight ?? '—'} kg × {latestSet.reps ?? '—'} · RIR {latestSet.rir ?? '—'}</p><small>{formatDateTime(latestSet.completedAt!)}</small></> : <p>Sin registro anterior</p>}</div></section>
          <section className="training-exercise-technique"><span className="training-detail-icon"><SectionIcon name="file" /></span><div><h3>Técnica</h3><ol>{(selected.techniqueNotes ?? 'Sin indicaciones guardadas.').split(/\n+/).filter(Boolean).map((line,index) => <li key={index}>{line}</li>)}</ol></div></section>
          <section className="training-exercise-muscles"><span className="training-detail-icon"><SectionIcon name="body" /></span><div><h3>Músculos trabajados</h3><p>Principales<small>{selected.id === 'ex-bench-press' ? 'Pectoral mayor, pectoral menor, tríceps' : selected.primaryMuscle}</small></p><p>Secundarios<small>{selected.id === 'ex-bench-press' ? 'Deltoides anterior, serrato anterior, core' : selected.secondaryMuscles.join(', ') || 'Sin secundarios indicados'}</small></p></div><ExerciseMuscleMap exercise={selected} /></section>
          <div className="training-exercise-contract-actions" data-central-exception="CENTRAL-AUTOEXCEPTION-G09-CONTEXTUAL-ACTIONS-01"><button type="button" disabled>＋ Usar en rutina<small>No disponible aquí</small></button><button type="button" disabled>Ver historial<small>No disponible aquí</small></button></div>
          <details className="training-personal-context"><summary>Contexto personal</summary>
          <label className="training-field"><span>Tolerancia personal</span><select value={tolerance} onChange={(event) => setTolerance(event.target.value as ExerciseTolerance | '')}><option value="">Sin registrar</option><option value="no_issues">Sin problemas</option><option value="occasional_discomfort">Molestia ocasional</option><option value="avoid_for_now">Evitar por ahora</option></select></label>
          <label className="training-field"><span>Notas personales</span><textarea value={personalNotes} onChange={(event) => setPersonalNotes(event.target.value)} /></label>
          <PrimaryButton type="button" disabled={busy} onClick={() => void saveContext()}>Guardar contexto</PrimaryButton>
          </details>
          {!isSystemExercise(selected) ? <div className="training-inline-actions"><button type="button" onClick={() => { setSelectedId(null); openEdit(selected) }}>Editar ejercicio</button><button type="button" onClick={() => setArchiveId(selected.id)}>Archivar</button></div> : null}
        </div> : null}
      </Sheet>

      <Sheet className="training-sheet training-sheet--exercise-editor" header={<TrainingOverlayHeader subtitle="Crear / Editar ejercicio" editor tab="exercises" onTabChange={onTabChange} onClose={() => setEditingId(null)} />} open={editingId !== null} title={editingId === 'new' ? 'Crear ejercicio' : 'Editar ejercicio'} subtitle="Ejercicio propio" onClose={() => setEditingId(null)}>
        <div className="training-custom-exercise-editor">
          <label className="training-field"><span>Nombre</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <section className="training-editor-preview"><span>Vista previa</span>{previewExercise ? <ExerciseVisual exercise={previewExercise} guided={false} /> : <p>La vista previa aparece al identificar un ejercicio del catálogo.</p>}</section>
          <div className="training-editor-grid">
            <label className="training-field"><span>Músculo principal</span><input value={draft.primaryMuscle} onChange={(event) => setDraft((current) => ({ ...current, primaryMuscle: event.target.value }))} /></label>
            <label className="training-field"><span>Secundarios</span><input value={draft.secondaryMuscles.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, secondaryMuscles: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></label>
            <label className="training-field"><span>Equipamiento</span><input value={draft.equipment} onChange={(event) => setDraft((current) => ({ ...current, equipment: event.target.value }))} /></label>
            <label className="training-field"><span>Patrón</span><select value={draft.exerciseType} onChange={(event) => setDraft((current) => ({ ...current, exerciseType: event.target.value as CustomExerciseDraft['exerciseType'] }))}><option value="compound">Compuesto</option><option value="isolation">Aislamiento</option><option value="core">Core</option><option value="mobility">Movilidad</option></select></label>
          </div>
          <div className="training-unavailable-actions" data-central-exception="CENTRAL-EXCEPTION-G11-EXERCISE-ACTIONS-01">
            <button type="button" disabled>Apto para calentamiento<small>No disponible</small></button>
            <span>Ejercicio propio</span>
            <button type="button" disabled>Marcar como favorito<small>No disponible</small></button>
          </div>
          <label className="training-field"><span>Técnica / cues</span><textarea value={draft.techniqueNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, techniqueNotes: event.target.value || null }))} /></label>
          <details className="training-editor-extra"><summary>Contexto y media propia</summary>
          <label className="training-field"><span>Notas personales</span><textarea value={draft.personalNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, personalNotes: event.target.value || null }))} /></label>
          <label className="training-field"><span>Media propia (ruta local opcional)</span><input value={draft.mediaPath ?? ''} placeholder="/media/..." onChange={(event) => setDraft((current) => ({ ...current, mediaPath: event.target.value || null, mediaType: event.target.value ? 'image' : null }))} /></label>
          </details>
          {error ? <p className="training-page-error" role="alert">{error}</p> : null}
          <div className="ds-dialog__actions"><SecondaryButton type="button" onClick={() => setEditingId(null)}>Cancelar</SecondaryButton><PrimaryButton type="button" disabled={busy} onClick={() => void saveCustom()}>{busy ? 'Guardando…' : 'Guardar ejercicio'}</PrimaryButton></div>
        </div>
      </Sheet>

      <ConfirmAction open={archiveId !== null} title="Archivar ejercicio" description="El ejercicio dejará de estar disponible para nuevas rutinas. El historial no se modifica." confirmLabel="Archivar" busy={busy} onCancel={() => setArchiveId(null)} onConfirm={archiveCustom} />
    </div>
  )
}

function HistoryView({
  history,
}: {
  history: HistorySessionView[]
}) {
  if (history.length === 0) {
    return (
      <section className="training-empty-card">
        <span className="training-kicker">HISTORIAL</span>
        <h2>Aún no hay sesiones finalizadas.</h2>
        <p>Las sesiones canceladas legacy se conservan en la base, pero no se presentan como entrenamiento realizado.</p>
      </section>
    )
  }

  return (
    <>
    <section className="training-history-summary" aria-label="Resumen del historial">
      <div><SectionIcon name="progress" /><strong>{history.length}</strong><span>sesiones totales</span></div>
      <div><SectionIcon name="clock" /><strong>{(() => {
        const durations = history.flatMap(item => {
          const end = item.session.endedAt ?? item.session.completedAt
          if (!end) return []
          const minutes = (Date.parse(end) - Date.parse(item.session.startedAt)) / 60000
          return Number.isFinite(minutes) && minutes >= 0 ? [minutes] : []
        })
        return durations.length ? `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)} min` : '—'
      })()}</strong><span>duración promedio</span></div>
      <div data-central-exception="CENTRAL-EXCEPTION-G06-TRAINING-VOLUME-KPI-01"><SectionIcon name="training" /><strong>—</strong><span>Métrica no disponible</span></div>
    </section>
    <h2 className="training-history-heading">Historial de sesiones</h2>
    <div className="training-history-list">
      {history.map((item) => {
        const workingSets = item.sets.filter((set) => set.setType === 'working')
        const end = item.session.endedAt ?? item.session.completedAt
        const date = new Date(end ?? item.session.startedAt)
        const minutes = end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(item.session.startedAt)) / 60000)) : null

        return (
          <details key={item.session.id} className="training-history-card">
            <summary>
            <time className="training-history-date" dateTime={date.toISOString()}><span>{new Intl.DateTimeFormat('es-ES',{weekday:'short'}).format(date).replace('.', '')}</span><strong>{date.getDate()} {new Intl.DateTimeFormat('es-ES',{month:'short'}).format(date).replace('.', '')}</strong></time>
            <SectionIcon name={item.session.templateName.toLowerCase().includes('lower') ? 'body' : 'training'} />
            <div>
              <h3>{item.session.templateName}</h3>
              <p>{minutes === null ? 'Duración no disponible' : `${minutes} min`} · {workingSets.length} series</p>
            </div>
            <span aria-label={item.session.status === 'completed' ? 'Completada' : 'Incompleta'} className={`training-history-status ${item.session.status === 'completed' ? 'is-completed' : 'is-incomplete'}`}>{item.session.status === 'completed' ? '✓' : '!'}</span><SectionIcon name="chevron" />
            </summary>
            <div className="training-history-exercises">
              {item.exercises.map((exercise) => {
                const exerciseSets = workingSets.filter(
                  (set) => set.workoutSessionExerciseId === exercise.id,
                )

                return (
                  <div key={exercise.id}>
                    <span>{exercise.exerciseName}</span>
                    <small>
                      {exerciseSets.length > 0
                        ? exerciseSets
                            .map((set) => `${set.weight ?? '—'}×${set.reps ?? '—'}`)
                            .join(' · ')
                        : 'sin series completadas'}
                    </small>
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
    </>
  )
}

async function fetchTrainingData(): Promise<TrainingData> {
  const [active, home, templates, history, exercises] = await Promise.all([
    getActiveWorkout(),
    getTrainingHome(),
    getTrainingTemplates(),
    getWorkoutHistory(50),
    getExerciseCatalog(),
  ])

  return {
    active,
    home,
    templates,
    history: history.sessions,
    exercises,
  }
}

export default function TrainingPage({
  isActive,
  refreshRevision,
}: TrainingPageProps) {
  const [tab, setTab] = useState<TrainingTab>('home')
  const [data, setData] = useState<TrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeVisible, setActiveVisible] = useState(true)
  const [reprogramSession, setReprogramSession] = useState<PlannedWorkoutSession | null>(null)
  const [reprogramDate, setReprogramDate] = useState('')
  const [omitSession, setOmitSession] = useState<PlannedWorkoutSession | null>(null)
  const actualToday = getSharedLocalDateKey()
  const [selectedDate, setSelectedDate] = useState(actualToday)


  async function reload() {
    const next = await fetchTrainingData()
    setData(next)
  }

  useEffect(() => {
    if (!isActive) return

    let active = true

    const timer = window.setTimeout(() => {
      setLoading(true)

      void fetchTrainingData()
        .then((next) => {
          if (!active) return
          setData(next)
          setError('')
          setLoading(false)
        })
        .catch((loadError: unknown) => {
          if (!active) return
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se ha podido cargar Training.',
          )
          setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [isActive, refreshRevision])

  const activeSessionId = data?.active?.session.id ?? null

  useEffect(() => {
    if (!isActive || activeSessionId === null || !activeVisible) return
    type WakeLockSentinelLike = { release: () => Promise<void> }
    type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || cancelled || sentinel) return
      try { sentinel = await wakeLock.request('screen') } catch { /* feature can be denied without breaking Training */ }
    }
    const visibility = () => {
      if (document.visibilityState === 'visible') void acquire()
      else if (sentinel) { void sentinel.release(); sentinel = null }
    }
    void acquire()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', visibility)
      if (sentinel) void sentinel.release()
    }
  }, [isActive, activeSessionId, activeVisible])

  async function startPlanned(session: PlannedWorkoutSession) {
    if (data?.active) {
      setActiveVisible(true)
      return
    }

    setBusy(true)

    try {
      await startPlannedWorkout(session.id)
      setError('')
      setActiveVisible(true)
      await reload()
    } catch (startError: unknown) {
      setError(
        startError instanceof Error ? startError.message : 'No se ha podido iniciar la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function startTemplate(templateId: string) {
    if (data?.active) {
      setActiveVisible(true)
      return
    }

    setBusy(true)

    try {
      await startTemplateWorkout(templateId)
      setActiveVisible(true)
      setError('')
      await reload()
    } catch (startError: unknown) {
      setError(
        startError instanceof Error ? startError.message : 'No se ha podido iniciar la rutina.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function confirmReprogram() {
    if (!reprogramSession || reprogramDate === '') return

    setBusy(true)

    try {
      await reprogramPlannedWorkout(reprogramSession.id, reprogramDate)
      setReprogramSession(null)
      setReprogramDate('')
      setError('')
      await reload()
    } catch (reprogramError: unknown) {
      setError(
        reprogramError instanceof Error
          ? reprogramError.message
          : 'No se ha podido reprogramar.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function confirmOmit() {
    if (!omitSession) return

    setBusy(true)

    try {
      await omitPlannedWorkout(omitSession.id)
      setOmitSession(null)
      setError('')
      await reload()
    } catch (omitError: unknown) {
      setError(
        omitError instanceof Error ? omitError.message : 'No se ha podido omitir la sesión.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading || !data) {
    return (
      <main className="training-page training-loading">
        <p>Preparando Training…</p>
      </main>
    )
  }

  if (data.active && activeVisible) {
    return (
      <ActiveTraining
        view={data.active}
        onReload={reload}
        onExit={() => setActiveVisible(false)}
      />
    )
  }

  return (
    <main className="training-page">
      <AppHeader
        title="Training"
        dateKey={actualToday}
        action={data.active ? (
          <button type="button" className="training-resume-button" onClick={() => setActiveVisible(true)}>Retomar sesión</button>
        ) : null}
      />

      <SegmentedTabs<TrainingTab>
        value={tab}
        label="Secciones de Training"
        onChange={setTab}
        items={[
          { value: 'home', label: 'Hoy' },
          { value: 'routines', label: 'Rutinas' },
          { value: 'exercises', label: 'Ejercicios' },
          { value: 'history', label: 'Historial' },
        ]}
      />

      {error ? <p className="training-page-error">{error}</p> : null}

      {tab === 'home' ? (
        <HomeView
          home={data.home}
          templates={data.templates}
          selectedDate={selectedDate}
          actualToday={actualToday}
          onSelectDate={setSelectedDate}
          onStart={startPlanned}
          onStartTemplate={startTemplate}
          onReprogram={(session) => {
            setReprogramSession(session)
            setReprogramDate(session.scheduledDate)
          }}
          onOmit={setOmitSession}
        />
      ) : null}

      {tab === 'routines' ? (
        <RoutinesView onTabChange={setTab} home={data.home} templates={data.templates} exercises={data.exercises} onReload={reload} onStartTemplate={startTemplate} starting={busy} />
      ) : null}

      {tab === 'exercises' ? (
        <ExercisesView onTabChange={setTab} history={data.history} exercises={data.exercises} onReload={reload} />
      ) : null}

      {tab === 'history' ? (
        <HistoryView history={data.history} />
      ) : null}

      {busy ? <div className="training-busy-toast">Guardando…</div> : null}

      <Dialog
        open={reprogramSession !== null}
        title={reprogramSession ? `Reprogramar · ${reprogramSession.templateName}` : 'Reprogramar sesión'}
        description="La identidad de la sesión se conserva. Nutrition mantiene asociados sus bloques Pre/Post pendientes."
        onClose={() => setReprogramSession(null)}
      >
        <label className="training-field">
          <span>Nueva fecha</span>
          <input type="date" value={reprogramDate} onChange={(event) => setReprogramDate(event.target.value)} />
        </label>
        <div className="ds-dialog__actions">
          <SecondaryButton type="button" onClick={() => setReprogramSession(null)}>Cancelar</SecondaryButton>
          <PrimaryButton type="button" disabled={busy || reprogramDate === ''} onClick={() => void confirmReprogram()}>Guardar fecha</PrimaryButton>
        </div>
      </Dialog>

      <ConfirmAction
        open={omitSession !== null}
        title={omitSession ? `Omitir · ${omitSession.templateName}` : 'Omitir sesión'}
        description="La omisión será explícita y romperá la racha de sesiones formales. No se aplica automáticamente a días sin registro."
        confirmLabel="Confirmar omisión"
        busy={busy}
        onCancel={() => setOmitSession(null)}
        onConfirm={confirmOmit}
      />
    </main>
  )
}
