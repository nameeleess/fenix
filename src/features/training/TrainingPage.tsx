import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type {
  ExerciseSet,
  SetType,
} from '../../types/training'
import {
  addExerciseSet,
  cancelWorkout,
  finishWorkout,
  getActiveWorkout,
  getTrainingTemplates,
  getWorkoutHistory,
  removeExerciseSet,
  saveSetDraft,
  startWorkout,
  toggleSetCompletion,
  type ActiveExerciseView,
  type ActiveSessionView,
  type HistorySessionView,
  type TrainingTemplateView,
} from './trainingService'
import './training.css'

type Section = 'workouts' | 'history'

function parseNullableNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim()

  if (normalized === '') {
    return null
  }

  const number = Number(normalized)

  if (!Number.isFinite(number)) {
    return null
  }

  return number
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatPreviousSet(set: ExerciseSet) {
  const reps =
    set.reps === null ? '—' : `${set.reps}`

  if (set.weight === null) {
    return `${reps} reps`
  }

  return `${set.weight} kg × ${reps}`
}

interface SetValues {
  weight: number | null
  reps: number | null
  rir: number | null
}

interface SetRowProps {
  set: ExerciseSet
  referenceWeight: number | null
  previousSet: ExerciseSet | undefined
  onSave: (
    setId: string,
    values: SetValues,
  ) => Promise<void>
  onToggle: (
    setId: string,
    values: SetValues,
  ) => Promise<void>
  onRemove: (set: ExerciseSet) => Promise<void>
}

function SetRow({
  set,
  referenceWeight,
  previousSet,
  onSave,
  onToggle,
  onRemove,
}: SetRowProps) {
  const [weight, setWeight] = useState(
    set.weight?.toString() ?? '',
  )
  const [reps, setReps] = useState(
    set.reps?.toString() ?? '',
  )
  const [rir, setRir] = useState(
    set.rir?.toString() ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function getValues(): SetValues {
    return {
      weight: parseNullableNumber(weight),
      reps: parseNullableNumber(reps),
      rir: parseNullableNumber(rir),
    }
  }

  async function save() {
    try {
      await onSave(set.id, getValues())
      setMessage('')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se ha podido guardar.',
      )
    }
  }

  async function toggle() {
    try {
      setBusy(true)
      setMessage('')

      await onToggle(
        set.id,
        getValues(),
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se ha podido completar la serie.',
      )
    } finally {
      setBusy(false)
    }
  }

  const placeholderWeight =
    previousSet?.weight ?? referenceWeight

  return (
    <div
      className={`set-row ${
        set.completedAt
          ? 'set-row--completed'
          : ''
      }`}
    >
      <div className="set-index">
        <span>
          {set.setType === 'warmup'
            ? 'C'
            : set.order}
        </span>

        <small>
          {set.setType === 'warmup'
            ? 'CAL'
            : 'SERIE'}
        </small>
      </div>

      <label>
        <span>kg</span>

        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={weight}
          placeholder={
            placeholderWeight === null
              ? '—'
              : String(placeholderWeight)
          }
          onChange={(event) =>
            setWeight(event.target.value)
          }
          onBlur={save}
        />
      </label>

      <label>
        <span>reps</span>

        <input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={reps}
          placeholder={
            previousSet?.reps?.toString() ?? '—'
          }
          onChange={(event) =>
            setReps(event.target.value)
          }
          onBlur={save}
        />
      </label>

      <label>
        <span>RIR</span>

        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="10"
          step="0.5"
          value={rir}
          placeholder={
            previousSet?.rir?.toString() ?? '2'
          }
          onChange={(event) =>
            setRir(event.target.value)
          }
          onBlur={save}
        />
      </label>

      <button
        className="set-complete-button"
        type="button"
        disabled={busy}
        aria-label={
          set.completedAt
            ? 'Desmarcar serie'
            : 'Completar serie'
        }
        onClick={toggle}
      >
        {set.completedAt ? '✓' : '○'}
      </button>

      <button
        className="set-remove-button"
        type="button"
        aria-label="Eliminar serie"
        onClick={() => onRemove(set)}
      >
        ×
      </button>

      {message && (
        <p className="set-message">
          {message}
        </p>
      )}
    </div>
  )
}

interface ExerciseCardProps {
  item: ActiveExerciseView
  sessionId: string
  onChanged: () => Promise<void>
  onCompletedSet: (seconds: number) => void
}

function ExerciseCard({
  item,
  sessionId,
  onChanged,
  onCompletedSet,
}: ExerciseCardProps) {
  async function addSet(setType: SetType) {
    await addExerciseSet(
      sessionId,
      item.exercise,
      setType,
    )

    await onChanged()
  }

  async function removeSet(set: ExerciseSet) {
    if (
      set.completedAt &&
      !window.confirm(
        'Esta serie ya está completada. ¿Quieres eliminarla?',
      )
    ) {
      return
    }

    await removeExerciseSet(set.id)
    await onChanged()
  }

  async function toggleSet(
    setId: string,
    values: SetValues,
  ) {
    const completed =
      await toggleSetCompletion(
        setId,
        values,
      )

    if (completed) {
      onCompletedSet(
        item.config.restSeconds,
      )
    }

    await onChanged()
  }

  return (
    <section className="exercise-card">
      <div className="exercise-card__header">
        <div>
          <p className="eyebrow">
            {item.exercise.primaryMuscle}
          </p>

          <h2>
            {item.exercise.name}
          </h2>

          <p className="exercise-target">
            {item.config.targetSets} ×{' '}
            {item.config.minReps}–
            {item.config.maxReps} · RIR{' '}
            {item.config.targetRir ?? '—'} ·
            descanso{' '}
            {Math.floor(
              item.config.restSeconds / 60,
            )}
            :
            {String(
              item.config.restSeconds % 60,
            ).padStart(2, '0')}
          </p>
        </div>

        {item.exercise.mediaPath ? (
          <div className="exercise-media">
            <img
              src={item.exercise.mediaPath}
              alt={`Demostración de ${item.exercise.name}`}
            />
          </div>
        ) : (
          <div
            className="exercise-media exercise-media--empty"
            aria-hidden="true"
          >
            DEMO
          </div>
        )}
      </div>

      {item.previousSets.length > 0 ? (
        <div className="previous-performance">
          <strong>
            Última vez
          </strong>

          <span>
            {item.previousSets
              .map(formatPreviousSet)
              .join(' · ')}
          </span>
        </div>
      ) : item.config.referenceWeight !== null ? (
        <div className="previous-performance">
          <strong>
            Referencia inicial
          </strong>

          <span>
            {item.config.referenceWeight} kg
          </span>
        </div>
      ) : (
        <div className="previous-performance">
          <strong>
            Sin historial
          </strong>

          <span>
            FÉNIX empezará a registrar desde hoy.
          </span>
        </div>
      )}

      <div className="sets-header">
        <span>Serie</span>
        <span>kg</span>
        <span>Reps</span>
        <span>RIR</span>
        <span />
        <span />
      </div>

      <div className="sets-list">
        {item.sets.map((set) => (
          <SetRow
            key={`${set.id}-${set.updatedAt}`}
            set={set}
            referenceWeight={
              item.config.referenceWeight
            }
            previousSet={
              item.previousSets.find(
                (previous) =>
                  previous.order ===
                  set.order,
              )
            }
            onSave={saveSetDraft}
            onToggle={toggleSet}
            onRemove={removeSet}
          />
        ))}
      </div>

      <div className="exercise-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            addSet('warmup')
          }
        >
          + Calentamiento
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            addSet('working')
          }
        >
          + Serie
        </button>
      </div>

      {item.exercise.techniqueNotes && (
        <p className="technique-note">
          {item.exercise.techniqueNotes}
        </p>
      )}
    </section>
  )
}

function HistoryCard({
  item,
}: {
  item: HistorySessionView
}) {
  const grouped =
    new Map<string, ExerciseSet[]>()

  for (const set of item.sets) {
    const existing =
      grouped.get(set.exerciseName) ?? []

    existing.push(set)

    grouped.set(
      set.exerciseName,
      existing,
    )
  }

  const completedAt =
    item.session.completedAt ??
    item.session.startedAt

  const durationMinutes = Math.max(
    1,
    Math.round(
      (Date.parse(completedAt) -
        Date.parse(
          item.session.startedAt,
        )) /
        60000,
    ),
  )

  return (
    <details className="history-card">
      <summary>
        <div>
          <strong>
            {item.session.templateName}
          </strong>

          <span>
            {formatDate(
              item.session.startedAt,
            )}
          </span>
        </div>

        <div className="history-card__meta">
          <span>
            {durationMinutes} min
          </span>

          <span>
            {item.sets.length} series
          </span>
        </div>
      </summary>

      <div className="history-card__content">
        {[...grouped.entries()].map(
          ([exerciseName, sets]) => (
            <div
              className="history-exercise"
              key={exerciseName}
            >
              <strong>
                {exerciseName}
              </strong>

              <span>
                {sets
                  .map(
                    formatPreviousSet,
                  )
                  .join(' · ')}
              </span>
            </div>
          ),
        )}
      </div>
    </details>
  )
}

function ErrorMessage({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      className="error-message"
      role="alert"
    >
      {children}
    </div>
  )
}

export default function TrainingPage() {
  const [templates, setTemplates] =
    useState<TrainingTemplateView[]>([])

  const [
    activeWorkout,
    setActiveWorkout,
  ] =
    useState<ActiveSessionView | null>(
      null,
    )

  const [history, setHistory] =
    useState<HistorySessionView[]>([])

  const [section, setSection] =
    useState<Section>('workouts')

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    timerSeconds,
    setTimerSeconds,
  ] = useState(0)

  const [
    timerRunning,
    setTimerRunning,
  ] = useState(false)

  useEffect(() => {
    void loadTraining()
  }, [])

  useEffect(() => {
    if (!timerRunning) {
      return
    }

    const interval =
      window.setInterval(() => {
        setTimerSeconds(
          (current) => {
            if (current <= 1) {
              setTimerRunning(false)

              return 0
            }

            return current - 1
          },
        )
      }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [timerRunning])

  async function loadTraining() {
    try {
      setLoading(true)
      setError('')

      const [
        loadedTemplates,
        loadedActiveWorkout,
        loadedHistory,
      ] = await Promise.all([
        getTrainingTemplates(),
        getActiveWorkout(),
        getWorkoutHistory(),
      ])

      setTemplates(
        loadedTemplates,
      )

      setActiveWorkout(
        loadedActiveWorkout,
      )

      setHistory(
        loadedHistory,
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se ha podido cargar Training.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function refreshActiveWorkout() {
    const active =
      await getActiveWorkout()

    setActiveWorkout(active)
  }

  async function handleStart(
    templateId: string,
  ) {
    try {
      setBusy(true)
      setError('')

      const workout =
        await startWorkout(
          templateId,
        )

      setActiveWorkout(workout)
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : 'No se ha podido iniciar.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleFinish() {
    if (!activeWorkout) {
      return
    }

    if (
      !window.confirm(
        '¿Finalizar este entrenamiento?',
      )
    ) {
      return
    }

    try {
      setBusy(true)
      setError('')

      await finishWorkout(
        activeWorkout.session.id,
      )

      setTimerRunning(false)
      setTimerSeconds(0)

      await loadTraining()
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : 'No se ha podido finalizar.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!activeWorkout) {
      return
    }

    if (
      !window.confirm(
        '¿Cancelar este entrenamiento? Esta sesión no contará en tu historial ni en tu progresión.',
      )
    ) {
      return
    }

    try {
      setBusy(true)
      setError('')

      await cancelWorkout(
        activeWorkout.session.id,
      )

      setTimerRunning(false)
      setTimerSeconds(0)

      await loadTraining()
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'No se ha podido cancelar.',
      )
    } finally {
      setBusy(false)
    }
  }

  function startRestTimer(
    seconds: number,
  ) {
    setTimerSeconds(seconds)
    setTimerRunning(true)
  }

  if (loading) {
    return (
      <main className="training-page">
        <p className="loading-text">
          Cargando Training…
        </p>
      </main>
    )
  }

  if (activeWorkout) {
    const completedSets =
      activeWorkout.exercises.reduce(
        (total, exercise) =>
          total +
          exercise.sets.filter(
            (set) =>
              set.completedAt !== null,
          ).length,
        0,
      )

    const totalSets =
      activeWorkout.exercises.reduce(
        (total, exercise) =>
          total +
          exercise.sets.length,
        0,
      )

    return (
      <main className="training-page">
        <header className="training-header training-header--active">
          <div>
            <p className="eyebrow">
              ENTRENAMIENTO EN CURSO
            </p>

            <h1>
              {activeWorkout.template.name}
            </h1>

            <p>
              {completedSets}/{totalSets}{' '}
              series completadas
            </p>
          </div>

          <div
            className={`rest-timer ${
              timerRunning
                ? 'rest-timer--running'
                : ''
            }`}
          >
            <small>
              DESCANSO
            </small>

            <strong>
              {formatTimer(
                timerSeconds,
              )}
            </strong>

            <div>
              <button
                type="button"
                disabled={
                  timerSeconds === 0
                }
                onClick={() =>
                  setTimerRunning(
                    (current) =>
                      !current,
                  )
                }
              >
                {timerRunning
                  ? 'Pausa'
                  : 'Seguir'}
              </button>

              <button
                type="button"
                disabled={
                  timerSeconds === 0
                }
                onClick={() => {
                  setTimerRunning(false)
                  setTimerSeconds(0)
                }}
              >
                ×
              </button>
            </div>
          </div>
        </header>

        {error && (
          <ErrorMessage>
            {error}
          </ErrorMessage>
        )}

        <div className="exercise-stack">
          {activeWorkout.exercises.map(
            (exercise) => (
              <ExerciseCard
                key={
                  exercise.exercise.id
                }
                item={exercise}
                sessionId={
                  activeWorkout
                    .session.id
                }
                onChanged={
                  refreshActiveWorkout
                }
                onCompletedSet={
                  startRestTimer
                }
              />
            ),
          )}
        </div>

        <button
          className="finish-workout-button"
          type="button"
          disabled={busy}
          onClick={handleFinish}
        >
          Finalizar entrenamiento
        </button>

        <button
          className="cancel-workout-button"
          type="button"
          disabled={busy}
          onClick={handleCancel}
        >
          Cancelar entrenamiento
        </button>
      </main>
    )
  }

  return (
    <main className="training-page">
      <header className="training-header">
        <div>
          <p className="eyebrow">
            FÉNIX
          </p>

          <h1>
            Training
          </h1>

          <p>
            Entrena, registra y construye tu
            progresión.
          </p>
        </div>
      </header>

      {error && (
        <ErrorMessage>
          {error}
        </ErrorMessage>
      )}

      <nav
        className="training-tabs"
        aria-label="Secciones de Training"
      >
        <button
          type="button"
          className={
            section === 'workouts'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection('workouts')
          }
        >
          Entrenos
        </button>

        <button
          type="button"
          className={
            section === 'history'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection('history')
          }
        >
          Historial
        </button>
      </nav>

      {section === 'workouts' ? (
        <section className="template-grid">
          {templates.map(
            (item) => (
              <article
                className="template-card"
                key={
                  item.template.id
                }
              >
                <div>
                  <p className="eyebrow">
                    {item.template
                      .type === 'upper'
                      ? 'TORSO'
                      : 'PIERNA'}
                  </p>

                  <h2>
                    {item.template.name}
                  </h2>

                  <p>
                    {
                      item.template
                        .description
                    }
                  </p>
                </div>

                <div className="template-stats">
                  <span>
                    {
                      item.exercises
                        .length
                    }{' '}
                    ejercicios
                  </span>

                  <span>
                    {item.totalSets}{' '}
                    series
                  </span>
                </div>

                <ol className="template-exercises">
                  {item.exercises.map(
                    (exercise) => (
                      <li
                        key={
                          exercise
                            .exercise.id
                        }
                      >
                        <span>
                          {
                            exercise
                              .exercise
                              .name
                          }
                        </span>

                        <small>
                          {
                            exercise
                              .config
                              .targetSets
                          }{' '}
                          ×{' '}
                          {
                            exercise
                              .config
                              .minReps
                          }
                          –
                          {
                            exercise
                              .config
                              .maxReps
                          }
                        </small>
                      </li>
                    ),
                  )}
                </ol>

                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() =>
                    handleStart(
                      item.template.id,
                    )
                  }
                >
                  Empezar entrenamiento
                </button>
              </article>
            ),
          )}
        </section>
      ) : (
        <section className="history-list">
          {history.length === 0 ? (
            <div className="empty-state">
              <strong>
                Todavía no hay entrenamientos.
              </strong>

              <p>
                El primero que finalices
                aparecerá aquí
                automáticamente.
              </p>
            </div>
          ) : (
            history.map(
              (item) => (
                <HistoryCard
                  key={
                    item.session.id
                  }
                  item={item}
                />
              ),
            )
          )}
        </section>
      )}
    </main>
  )
}