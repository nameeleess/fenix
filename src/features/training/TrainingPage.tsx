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
  updateRoutineExercise,
  type ActiveSessionView,
  type HistorySessionView,
  type SetValues,
  type TrainingHomeView,
  type TrainingTemplateView,
} from './trainingService'

import {
  ExerciseVisual,
  RoutineMuscleMap,
} from './TrainingVisuals'

import './training.css'

type TrainingTab =
  | 'home'
  | 'routines'
  | 'exercises'
  | 'history'

interface TrainingPageProps {
  isActive: boolean
  refreshRevision: number
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
        <span>{set.setType === 'warmup' ? 'C' : set.order}</span>
        {set.setType === 'warmup' ? <small>calent.</small> : null}
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

      <button
        type="button"
        className="training-set-row__remove"
        aria-label="Eliminar serie"
        onClick={() => void remove()}
      >
        ×
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
      <div>
        <span>DESCANSO</span>
        <strong>{minutes}:{String(seconds).padStart(2, '0')}</strong>
      </div>
      <button type="button" onClick={() => void onStop()}>
        Omitir
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
  const simpleTarget = item.snapshot.targetSeconds
    ? `${item.snapshot.targetSeconds} s`
    : `${item.snapshot.minReps}–${item.snapshot.maxReps} repeticiones`

  return (
    <main className="training-page training-page--active">
      <header className="training-active-header">
        <button type="button" className="training-back-button" onClick={onExit}>
          ‹
        </button>

        <div>
          <span className="training-kicker">TRAINING · EN CURSO</span>
          <h1>{view.template.name}</h1>
          <p>
            {view.completedWorkingSets}/{view.totalWorkingSets} {isGuidedSession ? 'pasos completados' : 'series de trabajo'} · iniciado {formatDateTime(view.session.startedAt)}
          </p>
        </div>

        <button
          type="button"
          className="training-finish-shortcut"
          onClick={() => setFinishOpen(true)}
        >
          Finalizar
        </button>
      </header>

      <RestTimer endsAt={view.restEndsAt} onStop={stopTimer} />

      <section className="training-current-card">
        <div className="training-current-card__top">
          <div>
            <span className="training-kicker">EJERCICIO {boundedIndex + 1} DE {view.exercises.length}</span>
            <h2>{item.exercise.name}</h2>
            <p>
              {isGuidedSession
                ? `${item.snapshot.targetSets} × ${simpleTarget}`
                : `${item.snapshot.targetSets} × ${item.snapshot.minReps}–${item.snapshot.maxReps} · RIR ${targetRir} · ${formatRest(item.snapshot.restSeconds)}`}
            </p>
          </div>

          <ExerciseVisual
            guided={isGuidedSession}
            exercise={item.exercise}
          />
        </div>

        {!isGuidedSession ? (
          <div className="training-reference-grid">
            <div>
              <span>ÚLTIMA VEZ</span>
              <strong>{previousText}</strong>
            </div>
            <div>
              <span>SUGERENCIA</span>
              <strong>{item.progressionHint}</strong>
            </div>
          </div>
        ) : null}

        {item.exercise.techniqueNotes ? (
          <details className="training-technique-note training-technique-note--disclosure">
            <summary>
              <span>TÉCNICA</span>
              <b>Ver indicación</b>
            </summary>
            <p>{item.exercise.techniqueNotes}</p>
          </details>
        ) : null}

        {warmups.length > 0 ? (
          <div className="training-set-section">
            <div className="training-set-section__title">
              <span>CALENTAMIENTO ESPECÍFICO</span>
              <small>Auto-sugerido · editable · no cuenta como volumen de trabajo</small>
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
            <small>{isGuidedSession ? 'Completa cada paso con control.' : 'Peso · repeticiones · RIR real'}</small>
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

          {!isGuidedSession ? (
            <button
              type="button"
              className="training-secondary-button"
              onClick={async () => {
                await addExerciseSet(item.snapshot.id, 'working')
                await onReload()
              }}
            >
              + Añadir serie
            </button>
          ) : null}
        </div>

        <div className="training-current-actions">
          <button
            type="button"
            className="training-secondary-button"
            onClick={() => void openSubstitute(item.snapshot)}
          >
            Sustituir ejercicio
          </button>

          {boundedIndex > 0 ? (
            <button
              type="button"
              className="training-ghost-button"
              onClick={() => setExerciseIndex(boundedIndex - 1)}
            >
              ← Anterior
            </button>
          ) : null}

          {boundedIndex < view.exercises.length - 1 ? (
            <button
              type="button"
              className="training-primary-button"
              onClick={() => setExerciseIndex(boundedIndex + 1)}
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              className="training-primary-button"
              onClick={() => setFinishOpen(true)}
            >
              Finalizar sesión
            </button>
          )}
        </div>
      </section>

      <section className="training-upcoming-card">
        <span className="training-kicker">SESIÓN</span>
        <div className="training-upcoming-list">
          {view.exercises.map((exerciseItem, index) => {
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
                <span>{index + 1}</span>
                <div>
                  <strong>{exerciseItem.exercise.name}</strong>
                  <small>{done}/{total} series · {exerciseItem.exercise.primaryMuscle}</small>
                </div>
                <b>{done === total && total > 0 ? '✓' : '›'}</b>
              </button>
            )
          })}
        </div>
      </section>

      {error ? <p className="training-page-error">{error}</p> : null}

      {finishOpen ? (
        <div className="training-dialog-backdrop" role="presentation">
          <section className="training-dialog" role="dialog" aria-modal="true" aria-label="Finalizar sesión">
            <span className="training-kicker">FINALIZAR</span>
            <h2>¿Cómo termina esta sesión?</h2>
            <p>
              Training no finaliza automáticamente. Elige el resultado real para conservar el historial y la racha correctamente.
            </p>

            <button
              type="button"
              className="training-primary-button"
              disabled={busy}
              onClick={() => void finalize('completed')}
            >
              Marcar completada
            </button>

            <button
              type="button"
              className="training-secondary-button"
              disabled={busy}
              onClick={() => void finalize('incomplete')}
            >
              Finalizar incompleta
            </button>

            <button
              type="button"
              className="training-danger-button"
              disabled={busy}
              onClick={() => void discard()}
            >
              Descartar si fue accidental
            </button>

            <button
              type="button"
              className="training-ghost-button"
              onClick={() => setFinishOpen(false)}
            >
              Volver a la sesión
            </button>
          </section>
        </div>
      ) : null}

      {substituteOpen ? (
        <div className="training-dialog-backdrop" role="presentation">
          <section className="training-dialog" role="dialog" aria-modal="true" aria-label="Sustituir ejercicio">
            <span className="training-kicker">SUSTITUCIÓN</span>
            <h2>{item.exercise.name}</h2>
            <p>El cambio se aplica a esta sesión. Solo modifica la rutina si lo indicas expresamente.</p>

            <label className="training-field">
              <span>Ejercicio alternativo</span>
              <select
                value={selectedAlternative}
                onChange={(event) => setSelectedAlternative(event.target.value)}
              >
                {alternatives.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name} · {exercise.primaryMuscle}
                  </option>
                ))}
              </select>
            </label>

            <label className="training-check-field">
              <input
                type="checkbox"
                checked={updateRoutine}
                onChange={(event) => setUpdateRoutine(event.target.checked)}
              />
              <span>Actualizar también la rutina futura</span>
            </label>

            <button
              type="button"
              className="training-primary-button"
              disabled={busy || selectedAlternative === ''}
              onClick={() => void confirmSubstitution()}
            >
              Aplicar sustitución
            </button>

            <button
              type="button"
              className="training-ghost-button"
              onClick={() => setSubstituteOpen(false)}
            >
              Cancelar
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function HomeView({
  home,
  onStart,
  onStartTemplate,
  onReprogram,
  onOmit,
}: {
  home: TrainingHomeView
  onStart: (session: PlannedWorkoutSession) => Promise<void>
  onStartTemplate: (templateId: string) => Promise<void>
  onReprogram: (session: PlannedWorkoutSession) => void
  onOmit: (session: PlannedWorkoutSession) => void
}) {
  const focus = home.focusSession
  const template = home.focusTemplate
  const multiSessionDays = home.week.filter((day) => day.sessions.length > 1)

  return (
    <>
      <section className="training-week-strip" aria-label="Semana de entrenamiento">
        {home.week.map((day) => (
          <div
            key={day.date}
            className={`training-week-day ${day.date === home.todayKey ? 'is-today' : ''} ${day.session ? statusClass(day.session.status) : ''}`}
          >
            <span>{day.weekdayLabel}</span>
            <strong>{day.dayNumber}</strong>
            <i />
            {day.sessions.length > 1 ? <small>{day.sessions.length}×</small> : null}
          </div>
        ))}
      </section>

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
                {focus.scheduledDate < home.todayKey
                  ? 'PENDIENTE ANTERIOR'
                  : focus.scheduledDate === home.todayKey
                    ? 'HOY'
                    : 'PRÓXIMA SESIÓN'}
              </span>
              <h2>{focus.templateName}</h2>
              <p>
                {formatDate(focus.scheduledDate)} · {focus.estimatedDurationMinutes ?? '—'} min estimados · {template.totalSets} series de trabajo
              </p>
            </div>
            <span className={`training-status-pill ${statusClass(focus.status)}`}>
              {statusLabel(focus.status)}
            </span>
          </div>

          <RoutineMuscleMap template={template} />

          <div className="training-session-preview">
            {template.exercises.slice(0, 4).map((item, index) => (
              <div key={item.config.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.exercise.name}</strong>
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

          <button
            type="button"
            className="training-primary-button"
            onClick={() => void onStart(focus)}
          >
            Iniciar {focus.templateName}
          </button>

          <div className="training-inline-actions">
            <button type="button" onClick={() => onReprogram(focus)}>
              Reprogramar
            </button>
            <button type="button" onClick={() => onOmit(focus)}>
              Omitir sesión
            </button>
          </div>
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
          <span>SEMANA</span>
          <strong>{home.completedThisWeek}/{home.plannedThisWeek}</strong>
          <small>sesiones formales completadas</small>
        </article>
        <article className="training-mini-card">
          <span>RACHA</span>
          <strong>{home.streakPending ? `${home.streak} · ?` : home.streak}</strong>
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

function RoutinesView({
  templates,
  onReload,
}: {
  templates: TrainingTemplateView[]
  onReload: () => Promise<void>
}) {
  const formal = templates.filter((item) => item.template.isFormalStrength)

  return (
    <div className="training-routines-grid">
      {formal.map((view) => (
        <section key={view.template.id} className="training-routine-card">
          <div className="training-routine-card__header">
            <div>
              <span className="training-kicker">RUTINA</span>
              <h2>{view.template.name}</h2>
              <p>{view.template.description}</p>
            </div>
            <strong>{view.totalSets} series</strong>
          </div>

          <RoutineMuscleMap template={view} compact />

          {view.exercises.map((item) => (
            <RoutineExerciseEditor
              key={`${item.config.id}-${item.config.updatedAt}`}
              item={item}
              onReload={onReload}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function RoutineExerciseEditor({
  item,
  onReload,
}: {
  item: TrainingTemplateView['exercises'][number]
  onReload: () => Promise<void>
}) {
  const [sets, setSets] = useState(String(item.config.targetSets))
  const [minReps, setMinReps] = useState(String(item.config.minReps))
  const [maxReps, setMaxReps] = useState(String(item.config.maxReps))
  const [rirMin, setRirMin] = useState(
    String(item.config.targetRirMin ?? item.config.targetRir ?? ''),
  )
  const [rirMax, setRirMax] = useState(
    String(item.config.targetRirMax ?? item.config.targetRir ?? ''),
  )
  const [rest, setRest] = useState(String(item.config.restSeconds))
  const [message, setMessage] = useState('')

  async function save() {
    try {
      await updateRoutineExercise(item.config.id, {
        targetSets: Number(sets),
        minReps: Number(minReps),
        maxReps: Number(maxReps),
        targetRirMin: rirMin === '' ? null : Number(rirMin),
        targetRirMax: rirMax === '' ? null : Number(rirMax),
        restSeconds: Number(rest),
      })
      setMessage('Guardado')
      await onReload()
    } catch (saveError: unknown) {
      setMessage(
        saveError instanceof Error ? saveError.message : 'No se ha podido guardar.',
      )
    }
  }

  return (
    <div className="training-routine-exercise">
      <div>
        <strong>{item.exercise.name}</strong>
        <small>{item.exercise.primaryMuscle}</small>
      </div>

      <label><span>Series</span><input value={sets} onChange={(event) => setSets(event.target.value)} /></label>
      <label><span>Rep min</span><input value={minReps} onChange={(event) => setMinReps(event.target.value)} /></label>
      <label><span>Rep max</span><input value={maxReps} onChange={(event) => setMaxReps(event.target.value)} /></label>
      <label><span>RIR min</span><input value={rirMin} onChange={(event) => setRirMin(event.target.value)} /></label>
      <label><span>RIR max</span><input value={rirMax} onChange={(event) => setRirMax(event.target.value)} /></label>
      <label><span>Desc. s</span><input value={rest} onChange={(event) => setRest(event.target.value)} /></label>

      <button type="button" onClick={() => void save()}>Guardar</button>
      {message ? <small className="training-editor-message">{message}</small> : null}
    </div>
  )
}

function ExercisesView({
  exercises,
  onReload,
}: {
  exercises: Exercise[]
  onReload: () => Promise<void>
}) {
  return (
    <div className="training-exercise-catalog">
      {exercises.map((exercise) => (
        <ExerciseContextEditor
          key={`${exercise.id}-${exercise.updatedAt}`}
          exercise={exercise}
          onReload={onReload}
        />
      ))}
    </div>
  )
}

function ExerciseContextEditor({
  exercise,
  onReload,
}: {
  exercise: Exercise
  onReload: () => Promise<void>
}) {
  const [tolerance, setTolerance] = useState<ExerciseTolerance | ''>(
    exercise.tolerance ?? '',
  )
  const [notes, setNotes] = useState(exercise.personalNotes ?? '')
  const [saved, setSaved] = useState('')

  async function save() {
    await updateExercisePersonalContext(exercise.id, {
      tolerance: tolerance === '' ? null : tolerance,
      personalNotes: notes.trim() === '' ? null : notes.trim(),
    })
    setSaved('Guardado')
    await onReload()
  }

  return (
    <article className="training-catalog-card">
      <div className="training-catalog-card__heading">
        <div>
          <span>{exercise.primaryMuscle}</span>
          <h3>{exercise.name}</h3>
          <p>{exercise.equipment}</p>
        </div>
        <b>{exercise.exerciseType}</b>
      </div>

      {exercise.techniqueNotes ? <p className="training-catalog-cue">{exercise.techniqueNotes}</p> : null}

      <label className="training-field">
        <span>Tolerancia personal</span>
        <select
          value={tolerance}
          onChange={(event) => setTolerance(event.target.value as ExerciseTolerance | '')}
        >
          <option value="">Sin registrar</option>
          <option value="no_issues">Sin problemas</option>
          <option value="occasional_discomfort">Molestia ocasional</option>
          <option value="avoid_for_now">Evitar por ahora</option>
        </select>
      </label>

      <label className="training-field">
        <span>Notas personales</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>

      <button type="button" className="training-secondary-button" onClick={() => void save()}>
        Guardar contexto
      </button>
      {saved ? <small className="training-editor-message">{saved}</small> : null}
    </article>
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
    <div className="training-history-list">
      {history.map((item) => {
        const workingSets = item.sets.filter((set) => set.setType === 'working')

        return (
          <article key={item.session.id} className="training-history-card">
            <div>
              <span className="training-kicker">
                {item.session.status === 'completed' ? 'COMPLETADA' : 'INCOMPLETA'}
              </span>
              <h3>{item.session.templateName}</h3>
              <p>{formatDateTime(item.session.endedAt ?? item.session.completedAt ?? item.session.startedAt)}</p>
            </div>
            <strong>{workingSets.length} series registradas</strong>

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
          </article>
        )
      })}
    </div>
  )
}

async function fetchTrainingData(): Promise<TrainingData> {
  const [active, home, templates, history, exercises] = await Promise.all([
    getActiveWorkout(),
    getTrainingHome(),
    getTrainingTemplates(),
    getWorkoutHistory(),
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

  const titleDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

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
      <header className="training-main-header">
        <div>
          <span className="training-brand">FÉNIX</span>
          <h1>TRAINING</h1>
          <p>{titleDate}</p>
        </div>

        {data.active ? (
          <button
            type="button"
            className="training-resume-button"
            onClick={() => setActiveVisible(true)}
          >
            Retomar sesión
          </button>
        ) : null}
      </header>

      <nav className="training-tabs" aria-label="Secciones de Training">
        {([
          ['home', 'Hoy'],
          ['routines', 'Rutinas'],
          ['exercises', 'Ejercicios'],
          ['history', 'Historial'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="training-page-error">{error}</p> : null}

      {tab === 'home' ? (
        <HomeView
          home={data.home}
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
        <RoutinesView templates={data.templates} onReload={reload} />
      ) : null}

      {tab === 'exercises' ? (
        <ExercisesView exercises={data.exercises} onReload={reload} />
      ) : null}

      {tab === 'history' ? (
        <HistoryView history={data.history} />
      ) : null}

      {busy ? <div className="training-busy-toast">Guardando…</div> : null}

      {reprogramSession ? (
        <div className="training-dialog-backdrop" role="presentation">
          <section className="training-dialog" role="dialog" aria-modal="true" aria-label="Reprogramar sesión">
            <span className="training-kicker">REPROGRAMAR</span>
            <h2>{reprogramSession.templateName}</h2>
            <p>La identidad de la sesión se conserva. Nutrition podrá mantener asociados sus bloques Pre/Post pendientes.</p>

            <label className="training-field">
              <span>Nueva fecha</span>
              <input
                type="date"
                value={reprogramDate}
                onChange={(event) => setReprogramDate(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="training-primary-button"
              disabled={busy || reprogramDate === ''}
              onClick={() => void confirmReprogram()}
            >
              Guardar nueva fecha
            </button>

            <button
              type="button"
              className="training-ghost-button"
              onClick={() => setReprogramSession(null)}
            >
              Cancelar
            </button>
          </section>
        </div>
      ) : null}

      {omitSession ? (
        <div className="training-dialog-backdrop" role="presentation">
          <section className="training-dialog" role="dialog" aria-modal="true" aria-label="Omitir sesión">
            <span className="training-kicker">OMITIR</span>
            <h2>{omitSession.templateName}</h2>
            <p>La omisión será explícita y romperá la racha de sesiones formales. No se aplica automáticamente a días sin registro.</p>

            <button
              type="button"
              className="training-danger-button"
              disabled={busy}
              onClick={() => void confirmOmit()}
            >
              Confirmar omisión
            </button>

            <button
              type="button"
              className="training-ghost-button"
              onClick={() => setOmitSession(null)}
            >
              Volver
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}
