import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  db,
} from '../../db/database'

import type {
  WorkoutSession,
  WorkoutTemplate,
} from '../../types/training'

import type {
  DailyRoutineTask,
  TodayBlock,
  TodayTaskStatus,
  WorkShift,
} from '../../types/today'

import {
  addOneOffTask,
  deleteOneOffTask,
  ensureDailyRoutine,
  getDailyRoutineView,
  getLocalDateKey,
  setDailyTaskStatus,
  startDay,
  type DailyRoutineView,
} from './todayService'

import './today.css'

interface TodayPageProps {
  isActive: boolean

  onOpenTraining: () => void

  onOpenNutrition: () => void

  onOpenProgress: () => void
}

type TrainingTodayStatus =
  | 'rest'
  | 'pending'
  | 'active'
  | 'completed'

interface TrainingTodaySummary {
  status: TrainingTodayStatus

  template:
    | WorkoutTemplate
    | null

  session:
    | WorkoutSession
    | null

  title: string

  durationMinutes:
    | number
    | null
}

const BLOCKS: {
  key: TodayBlock

  label: string
}[] = [
  {
    key: 'morning',
    label: 'MAÑANA',
  },
  {
    key: 'postworkout',
    label: 'POSTENTRENO',
  },
  {
    key: 'development',
    label: 'DESARROLLO',
  },
  {
    key: 'work',
    label: 'TRABAJO',
  },
  {
    key: 'night',
    label: 'NOCHE',
  },
]

const STATUS_LABELS:
  Record<
    TodayTaskStatus,
    string
  > = {
  pending: 'Pendiente',
  completed: 'Completada',
  skipped: 'Omitida',
  not_applicable:
    'No aplica',
}

function parseLocalDateKey(
  dateKey: string,
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split('-')
      .map(Number)

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0,
  )
}

function formatTodayDate(
  dateKey: string,
) {
  const formatted =
    new Intl.DateTimeFormat(
      'es-ES',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      },
    ).format(
      parseLocalDateKey(
        dateKey,
      ),
    )

  return (
    formatted
      .charAt(0)
      .toUpperCase() +
    formatted.slice(1)
  )
}

function getIsoDateKey(
  value: string | null,
) {
  if (!value) {
    return null
  }

  return getLocalDateKey(
    new Date(value),
  )
}

function calculateDurationMinutes(
  session:
    WorkoutSession,
) {
  if (
    !session.completedAt
  ) {
    return null
  }

  const start =
    new Date(
      session.startedAt,
    ).getTime()

  const end =
    new Date(
      session.completedAt,
    ).getTime()

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return null
  }

  return Math.round(
    (end - start) /
      60000,
  )
}

async function getTrainingTodaySummary(
  dateKey: string,
): Promise<TrainingTodaySummary> {
  const weekday =
    parseLocalDateKey(
      dateKey,
    ).getDay()

  const templates =
    await db
      .workoutTemplates
      .where('dayOfWeek')
      .equals(weekday)
      .toArray()

  const scheduledTemplate =
    templates.find(
      (template) =>
        template.deletedAt ===
        null,
    ) ?? null

  const sessions =
    await db
      .workoutSessions
      .toArray()

  const validSessions =
    sessions.filter(
      (session) =>
        session.deletedAt ===
        null,
    )

  const activeSession =
    validSessions.find(
      (session) =>
        session.status ===
          'active' &&
        getIsoDateKey(
          session.startedAt,
        ) === dateKey,
    ) ?? null

  if (activeSession) {
    const template =
      await db
        .workoutTemplates
        .get(
          activeSession
            .workoutTemplateId,
        )

    return {
      status: 'active',

      template:
        template ?? null,

      session:
        activeSession,

      title:
        activeSession
          .templateName,

      durationMinutes: null,
    }
  }

  const completedToday =
    validSessions
      .filter(
        (session) =>
          session.status ===
            'completed' &&
          getIsoDateKey(
            session.completedAt,
          ) === dateKey,
      )
      .sort(
        (first, second) =>
          new Date(
            second.completedAt ??
              second.startedAt,
          ).getTime() -
          new Date(
            first.completedAt ??
              first.startedAt,
          ).getTime(),
      )[0] ?? null

  if (completedToday) {
    const template =
      await db
        .workoutTemplates
        .get(
          completedToday
            .workoutTemplateId,
        )

    return {
      status:
        'completed',

      template:
        template ?? null,

      session:
        completedToday,

      title:
        completedToday
          .templateName,

      durationMinutes:
        calculateDurationMinutes(
          completedToday,
        ),
    }
  }

  if (scheduledTemplate) {
    return {
      status: 'pending',

      template:
        scheduledTemplate,

      session: null,

      title:
        scheduledTemplate.name,

      durationMinutes: null,
    }
  }

  return {
    status: 'rest',

    template: null,

    session: null,

    title:
      'Descanso programado',

    durationMinutes: null,
  }
}

function getTrainingStatusLabel(
  summary:
    TrainingTodaySummary,
) {
  switch (
    summary.status
  ) {
    case 'active':
      return 'En curso'

    case 'completed':
      return summary
        .durationMinutes !==
        null
        ? `Completado · ${summary.durationMinutes} min`
        : 'Completado'

    case 'pending':
      return 'Pendiente'

    case 'rest':
      return 'Sin entrenamiento previsto'
  }
}

function getTaskStatusSymbol(
  status:
    TodayTaskStatus,
) {
  switch (status) {
    case 'completed':
      return '✓'

    case 'skipped':
      return '—'

    case 'not_applicable':
      return '×'

    case 'pending':
      return ''
  }
}

function TodayPage({
  isActive,

  onOpenTraining,

  onOpenNutrition,

  onOpenProgress,
}: TodayPageProps) {
  const dateKey =
    useMemo(
      () =>
        getLocalDateKey(),
      [],
    )

  const [
    view,
    setView,
  ] =
    useState<
      DailyRoutineView | null
    >(null)

  const [
    training,
    setTraining,
  ] =
    useState<
      TrainingTodaySummary | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const [
    openBlock,
    setOpenBlock,
  ] =
    useState<TodayBlock>(
      'morning',
    )

  const [
    taskMenuId,
    setTaskMenuId,
  ] =
    useState<
      string | null
    >(null)

  const [
    addingTask,
    setAddingTask,
  ] =
    useState(false)

  const [
    newTaskTitle,
    setNewTaskTitle,
  ] =
    useState('')

  const [
    newTaskBlock,
    setNewTaskBlock,
  ] =
    useState<TodayBlock>(
      'development',
    )

  const loadDay =
    useCallback(
      async () => {
        try {
          setError(null)

          const [
            trainingSummary,
            existingShift,
          ] =
            await Promise.all([
              getTrainingTodaySummary(
                dateKey,
              ),

              db.workShifts
                .where('date')
                .equals(
                  dateKey,
                )
                .first(),
            ])

          const isTrainingDay =
            trainingSummary.status !==
              'rest'

          const isWorkDay =
            Boolean(
              existingShift &&
                existingShift
                  .deletedAt ===
                  null &&
                existingShift
                  .isWorking,
            )

          await ensureDailyRoutine(
            dateKey,
            {
              isTrainingDay,
              isWorkDay,
            },
          )

          const nextView =
            await getDailyRoutineView(
              dateKey,
            )

          setTraining(
            trainingSummary,
          )

          setView(
            nextView,
          )

          if (
            nextView
          ) {
            const firstPending =
              nextView.tasks.find(
                (task) =>
                  task.status ===
                  'pending',
              )

            if (
              firstPending
            ) {
              setOpenBlock(
                firstPending.block,
              )
            }
          }
        } catch (
          loadError
        ) {
          console.error(
            'Error cargando Hoy:',
            loadError,
          )

          setError(
            'No se ha podido cargar el día.',
          )
        } finally {
          setLoading(false)
        }
      },
      [dateKey],
    )

    useEffect(() => {
    if (!isActive) {
      return
    }

    const timeoutId =
      window.setTimeout(
        () => {
          void loadDay()
        },
        0,
      )

    return () => {
      window.clearTimeout(
        timeoutId,
      )
    }
  }, [
    isActive,
    loadDay,
  ])

  const tasks =
    view?.tasks ?? []

  const applicableTasks =
    tasks.filter(
      (task) =>
        task.status !==
        'not_applicable',
    )

  const completedTasks =
    applicableTasks.filter(
      (task) =>
        task.status ===
        'completed',
    )

  const routineProgress =
    applicableTasks.length ===
    0
      ? 0
      : Math.round(
          (
            completedTasks.length /
            applicableTasks.length
          ) *
            100,
        )

  const recommendedTask =
    tasks.find(
      (task) =>
        task.status ===
        'pending',
    ) ?? null

  const workShift:
    WorkShift | null =
    view?.workShift ?? null

  const visibleBlocks =
    BLOCKS.filter(
      (block) => {
        const hasTasks =
          tasks.some(
            (task) =>
              task.block ===
              block.key &&
              task.status !==
                'not_applicable',
          )

        if (
          block.key ===
          'development'
        ) {
          return true
        }

        if (
          block.key ===
          'work'
        ) {
          return Boolean(
            workShift?.isWorking,
          )
        }

        return hasTasks
      },
    )

  async function refresh() {
    await loadDay()
  }

  async function handleStartDay() {
    if (!training) {
      return
    }

    try {
      const next =
        await startDay(
          dateKey,
          {
            isTrainingDay:
              training.status !==
              'rest',

            isWorkDay:
              Boolean(
                workShift
                  ?.isWorking,
              ),
          },
        )

      setView(next)
    } catch (
      startError
    ) {
      console.error(
        startError,
      )

      setError(
        'No se ha podido iniciar el día.',
      )
    }
  }

  async function handleTaskToggle(
    task:
      DailyRoutineTask,
  ) {
    const nextStatus:
      TodayTaskStatus =
      task.status ===
      'completed'
        ? 'pending'
        : 'completed'

    try {
      await setDailyTaskStatus(
        task.id,
        nextStatus,
      )

      await refresh()
    } catch (
      taskError
    ) {
      console.error(
        taskError,
      )

      setError(
        'No se ha podido actualizar la tarea.',
      )
    }
  }

  async function handleStatusChange(
    task:
      DailyRoutineTask,

    status:
      TodayTaskStatus,
  ) {
    try {
      await setDailyTaskStatus(
        task.id,
        status,
      )

      setTaskMenuId(null)

      await refresh()
    } catch (
      taskError
    ) {
      console.error(
        taskError,
      )

      setError(
        'No se ha podido cambiar el estado.',
      )
    }
  }

  async function handleDeleteOneOff(
    task:
      DailyRoutineTask,
  ) {
    try {
      await deleteOneOffTask(
        task.id,
      )

      setTaskMenuId(null)

      await refresh()
    } catch (
      taskError
    ) {
      console.error(
        taskError,
      )

      setError(
        'No se ha podido eliminar la tarea.',
      )
    }
  }

  async function handleAddTask() {
    const title =
      newTaskTitle.trim()

    if (
      !title ||
      !training
    ) {
      return
    }

    try {
      await addOneOffTask(
        dateKey,
        {
          block:
            newTaskBlock,

          title,
        },
        {
          isTrainingDay:
            training.status !==
            'rest',

          isWorkDay:
            Boolean(
              workShift
                ?.isWorking,
            ),
        },
      )

      setNewTaskTitle('')

      setAddingTask(false)

      setOpenBlock(
        newTaskBlock,
      )

      await refresh()
    } catch (
      taskError
    ) {
      console.error(
        taskError,
      )

      setError(
        'No se ha podido añadir la tarea.',
      )
    }
  }

  if (loading) {
    return (
      <main className="today-page">
        <div className="today-shell">
          <p className="today-loading">
            Preparando Hoy…
          </p>
        </div>
      </main>
    )
  }

  if (
    error &&
    !view
  ) {
    return (
      <main className="today-page">
        <div className="today-shell">
          <section className="today-error-card">
            <span>
              FÉNIX
            </span>

            <h1>
              Hoy no está disponible
            </h1>

            <p>
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void refresh()
              }
            >
              Reintentar
            </button>
          </section>
        </div>
      </main>
    )
  }

  if (!view) {
    return null
  }

  const dayStarted =
    view.routine
      .startedAt !== null

  return (
    <main className="today-page">
      <div className="today-shell">
        <header className="today-header">
          <div>
            <span className="today-brand">
              FÉNIX
            </span>

            <h1>
              HOY
            </h1>

            <p>
              {formatTodayDate(
                dateKey,
              )}
            </p>
          </div>
        </header>

        {error && (
          <div
            className="today-inline-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {!dayStarted ? (
          <section className="today-start-card">
            <img
              src="/fenix-icon-192.png"
              alt=""
              className="today-start-card__icon"
            />

            <div>
              <span className="today-eyebrow">
                HOY
              </span>

              <h2>
                Tu día está preparado
              </h2>

              <p>
                La rutina ya existe.
                Iniciar el día solo
                activa la experiencia
                visual de Hoy.
              </p>
            </div>

            <button
              type="button"
              className="today-primary-button"
              onClick={() =>
                void handleStartDay()
              }
            >
              Iniciar día
            </button>
          </section>
        ) : (
          <>
            <section className="today-hero">
              <div className="today-hero__progress">
                <div
                  className="today-progress-ring"
                  style={{
                    background:
                      `conic-gradient(var(--fenix-accent) ${routineProgress}%, var(--fenix-border) ${routineProgress}% 100%)`,
                  }}
                >
                  <div className="today-progress-ring__inner">
                    <strong>
                      {routineProgress}
                      %
                    </strong>

                    <span>
                      rutina
                    </span>
                  </div>
                </div>

                <div className="today-hero__numbers">
                  <strong>
                    {
                      completedTasks.length
                    }
                    /
                    {
                      applicableTasks.length
                    }
                  </strong>

                  <span>
                    tareas locales
                  </span>
                </div>
              </div>

              <div className="today-now-card">
                <span className="today-eyebrow">
                  AHORA
                </span>

                {training?.status ===
                'active' ? (
                  <>
                    <h2>
                      {
                        training.title
                      }
                    </h2>

                    <p>
                      Entrenamiento
                      en curso
                    </p>

                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={
                        onOpenTraining
                      }
                    >
                      Continuar entrenamiento
                    </button>
                  </>
                ) : recommendedTask ? (
                  <>
                    <h2>
                      {
                        recommendedTask.title
                      }
                    </h2>

                    {recommendedTask.description && (
                      <p>
                        {
                          recommendedTask.description
                        }
                      </p>
                    )}

                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={() =>
                        void handleTaskToggle(
                          recommendedTask,
                        )
                      }
                    >
                      Completar
                    </button>
                  </>
                ) : (
                  <>
                    <h2>
                      Rutina completada
                    </h2>

                    <p>
                      No quedan tareas
                      locales pendientes.
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="today-section">
              <div className="today-section-heading">
                <div>
                  <span className="today-eyebrow">
                    RUTINA
                  </span>

                  <h2>
                    Tu día
                  </h2>
                </div>

                <button
                  type="button"
                  className="today-text-button"
                  onClick={() =>
                    setAddingTask(
                      (current) =>
                        !current,
                    )
                  }
                >
                  + Añadir para hoy
                </button>
              </div>

              {addingTask && (
                <div className="today-add-task">
                  <input
                    type="text"
                    value={
                      newTaskTitle
                    }
                    placeholder="Nueva acción"
                    aria-label="Nombre de la nueva acción"
                    onChange={(
                      event,
                    ) =>
                      setNewTaskTitle(
                        event.target
                          .value,
                      )
                    }
                  />

                  <select
                    value={
                      newTaskBlock
                    }
                    aria-label="Bloque de la nueva acción"
                    onChange={(
                      event,
                    ) =>
                      setNewTaskBlock(
                        event.target
                          .value as TodayBlock,
                      )
                    }
                  >
                    {BLOCKS.map(
                      (block) => (
                        <option
                          key={
                            block.key
                          }
                          value={
                            block.key
                          }
                        >
                          {
                            block.label
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <div className="today-add-task__actions">
                    <button
                      type="button"
                      className="today-secondary-button"
                      onClick={() =>
                        setAddingTask(
                          false,
                        )
                      }
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      disabled={
                        newTaskTitle
                          .trim()
                          .length ===
                        0
                      }
                      onClick={() =>
                        void handleAddTask()
                      }
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              )}

              <div className="today-block-list">
                {visibleBlocks.map(
                  (block) => {
                    const blockTasks =
                      tasks.filter(
                        (task) =>
                          task.block ===
                            block.key &&
                          task.status !==
                            'not_applicable',
                      )

                    const completed =
                      blockTasks.filter(
                        (task) =>
                          task.status ===
                          'completed',
                      ).length

                    const isOpen =
                      openBlock ===
                      block.key

                    return (
                      <article
                        key={
                          block.key
                        }
                        className={
                          isOpen
                            ? 'today-block today-block--open'
                            : 'today-block'
                        }
                      >
                        <button
                          type="button"
                          className="today-block__header"
                          onClick={() =>
                            setOpenBlock(
                              isOpen
                                ? 'development'
                                : block.key,
                            )
                          }
                        >
                          <span>
                            {
                              block.label
                            }
                          </span>

                          <span className="today-block__summary">
                            {block.key ===
                              'work' &&
                            workShift?.isWorking ? (
                              <>
                                {
                                  workShift.startTime
                                }
                                –
                                {
                                  workShift.endTime
                                }
                              </>
                            ) : blockTasks.length >
                              0 ? (
                              <>
                                {
                                  completed
                                }
                                /
                                {
                                  blockTasks.length
                                }
                              </>
                            ) : (
                              'Sin acciones'
                            )}

                            <span
                              aria-hidden="true"
                            >
                              {isOpen
                                ? '⌃'
                                : '›'}
                            </span>
                          </span>
                        </button>

                        {isOpen && (
                          <div className="today-block__body">
                            {blockTasks.length ===
                            0 ? (
                              <div className="today-empty-block">
                                <p>
                                  No hay
                                  acciones
                                  añadidas.
                                </p>

                                {block.key ===
                                  'development' && (
                                  <button
                                    type="button"
                                    className="today-text-button"
                                    onClick={() => {
                                      setNewTaskBlock(
                                        'development',
                                      )

                                      setAddingTask(
                                        true,
                                      )
                                    }}
                                  >
                                    + Añadir acción
                                  </button>
                                )}
                              </div>
                            ) : (
                              blockTasks.map(
                                (
                                  task,
                                ) => (
                                  <div
                                    key={
                                      task.id
                                    }
                                    className={`today-task today-task--${task.status}`}
                                  >
                                    <button
                                      type="button"
                                      className="today-task__check"
                                      aria-label={
                                        task.status ===
                                        'completed'
                                          ? `Desmarcar ${task.title}`
                                          : `Completar ${task.title}`
                                      }
                                      onClick={() =>
                                        void handleTaskToggle(
                                          task,
                                        )
                                      }
                                    >
                                      <span>
                                        {getTaskStatusSymbol(
                                          task.status,
                                        )}
                                      </span>
                                    </button>

                                    <div className="today-task__content">
                                      <strong>
                                        {
                                          task.title
                                        }
                                      </strong>

                                      {task.description && (
                                        <span>
                                          {
                                            task.description
                                          }
                                        </span>
                                      )}

                                      {task.status !==
                                        'pending' && (
                                        <small>
                                          {
                                            STATUS_LABELS[
                                              task
                                                .status
                                            ]
                                          }
                                        </small>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      className="today-task__menu-button"
                                      aria-label={`Opciones de ${task.title}`}
                                      onClick={() =>
                                        setTaskMenuId(
                                          taskMenuId ===
                                            task.id
                                            ? null
                                            : task.id,
                                        )
                                      }
                                    >
                                      ···
                                    </button>

                                    {taskMenuId ===
                                      task.id && (
                                      <div className="today-task-menu">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleStatusChange(
                                              task,
                                              'pending',
                                            )
                                          }
                                        >
                                          Pendiente
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleStatusChange(
                                              task,
                                              'skipped',
                                            )
                                          }
                                        >
                                          Omitida
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleStatusChange(
                                              task,
                                              'not_applicable',
                                            )
                                          }
                                        >
                                          No aplica
                                        </button>

                                        {task.kind ===
                                          'one_off' && (
                                          <button
                                            type="button"
                                            className="danger"
                                            onClick={() =>
                                              void handleDeleteOneOff(
                                                task,
                                              )
                                            }
                                          >
                                            Eliminar
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ),
                              )
                            )}
                          </div>
                        )}
                      </article>
                    )
                  },
                )}
              </div>
            </section>

            <section className="today-module-grid">
              <article className="today-module-card">
                <div className="today-module-card__heading">
                  <span className="today-module-card__icon">
                    T
                  </span>

                  <span>
                    TRAINING
                  </span>
                </div>

                <h3>
                  {training?.title ??
                    'Training'}
                </h3>

                <p>
                  {training
                    ? getTrainingStatusLabel(
                        training,
                      )
                    : 'Sin información'}
                </p>

                {training?.status !==
                  'rest' && (
                  <button
                    type="button"
                    className="today-card-link"
                    onClick={
                      onOpenTraining
                    }
                  >
                    {training?.status ===
                    'active'
                      ? 'Continuar'
                      : 'Abrir Training'}
                    <span>
                      ›
                    </span>
                  </button>
                )}
              </article>

              <article className="today-module-card">
                <div className="today-module-card__heading">
                  <span className="today-module-card__icon">
                    N
                  </span>

                  <span>
                    NUTRITION
                  </span>
                </div>

                <h3>
                  Sin planificación aplicable
                </h3>

                <p>
                  Hoy no inventa una
                  comida si Nutrition
                  no dispone de un
                  registro diario.
                </p>

                <button
                  type="button"
                  className="today-card-link"
                  onClick={
                    onOpenNutrition
                  }
                >
                  Abrir Nutrition
                  <span>
                    ›
                  </span>
                </button>
              </article>
            </section>

            <section className="today-progress-card">
              <div className="today-progress-card__heading">
                <div>
                  <span className="today-eyebrow">
                    PROGRESO
                  </span>

                  <h2>
                    Estado reciente
                  </h2>
                </div>

                <button
                  type="button"
                  className="today-card-link today-card-link--inline"
                  onClick={
                    onOpenProgress
                  }
                >
                  Ver
                  <span>
                    ›
                  </span>
                </button>
              </div>

              <div className="today-progress-placeholder-grid">
                <div>
                  <span>
                    Peso
                  </span>

                  <strong>
                    —
                  </strong>

                  <small>
                    Datos insuficientes
                  </small>
                </div>

                <div>
                  <span>
                    Adherencia
                  </span>

                  <strong>
                    —
                  </strong>

                  <small>
                    Sin historial suficiente
                  </small>
                </div>
              </div>
            </section>

            <p className="today-development-note">
              La cifra superior refleja
              únicamente la rutina local
              disponible actualmente.
              Training, Nutrition y
              Progreso se incorporarán al
              cumplimiento global cuando
              sus contratos diarios estén
              conectados.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default TodayPage