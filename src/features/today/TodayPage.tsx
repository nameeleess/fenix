import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import { db } from '../../db/database'
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
import {
  getTodayIntegrationSummary,
  type TodayIntegrationSummary,
} from './todayIntegrationService'

import './today.css'
import './today-integration.css'

interface TodayPageProps {
  isActive: boolean
  onOpenTraining: () => void
  onOpenNutrition: () => void
  onOpenProgress: () => void
}

const BLOCKS: Array<{ key: TodayBlock; label: string }> = [
  { key: 'morning', label: 'MAÑANA' },
  { key: 'postworkout', label: 'POSTENTRENO' },
  { key: 'development', label: 'DESARROLLO' },
  { key: 'work', label: 'TRABAJO' },
  { key: 'night', label: 'NOCHE' },
]

const STATUS_LABELS: Record<TodayTaskStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  skipped: 'Omitida',
  not_applicable: 'No aplica',
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatTodayDate(dateKey: string) {
  const value = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseDateKey(dateKey))

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)
}

function getTaskStatusSymbol(status: TodayTaskStatus) {
  if (status === 'completed') return '✓'
  if (status === 'skipped') return '—'
  if (status === 'not_applicable') return '×'
  return ''
}

function progressColor(progress: number) {
  if (progress >= 80) return 'var(--fenix-success)'
  if (progress >= 45) return '#e9952e'
  return 'var(--fenix-accent)'
}

function weightPrimary(summary: TodayIntegrationSummary['progress']) {
  if (summary.weight.currentMean !== null) {
    return `${formatNumber(summary.weight.currentMean, 1)} kg`
  }

  if (summary.weight.latest) {
    return `${formatNumber(summary.weight.latest.weightKg, 1)} kg`
  }

  return '—'
}

function TodayPage({
  isActive,
  onOpenTraining,
  onOpenNutrition,
  onOpenProgress,
}: TodayPageProps) {
  const dateKey = useMemo(() => getLocalDateKey(), [])

  const [view, setView] = useState<DailyRoutineView | null>(null)
  const [integration, setIntegration] = useState<TodayIntegrationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openBlock, setOpenBlock] = useState<TodayBlock>('morning')
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskBlock, setNewTaskBlock] = useState<TodayBlock>('development')

  const loadDay = useCallback(async () => {
    try {
      setError(null)

      const [moduleSummary, existingShift] = await Promise.all([
        getTodayIntegrationSummary(dateKey),
        db.workShifts.where('date').equals(dateKey).first(),
      ])

      const isTrainingDay =
        moduleSummary.training.status !== 'rest' &&
        moduleSummary.training.status !== 'omitted'

      const isWorkDay = Boolean(
        existingShift &&
          existingShift.deletedAt === null &&
          existingShift.isWorking,
      )

      await ensureDailyRoutine(dateKey, {
        isTrainingDay,
        isWorkDay,
      })

      const nextView = await getDailyRoutineView(dateKey)

      setIntegration(moduleSummary)
      setView(nextView)

      const firstPending = nextView?.tasks.find(
        (task) => task.status === 'pending',
      )

      if (firstPending) {
        setOpenBlock(firstPending.block)
      }
    } catch (loadError) {
      console.error('Error cargando Hoy:', loadError)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se ha podido cargar el día.',
      )
    } finally {
      setLoading(false)
    }
  }, [dateKey])

  useEffect(() => {
    if (!isActive) return

    const timer = window.setTimeout(() => {
      void loadDay()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isActive, loadDay])

  const tasks = view?.tasks ?? []
  const applicableTasks = tasks.filter((task) => task.status !== 'not_applicable')
  const completedTasks = applicableTasks.filter((task) => task.status === 'completed')
  const routineProgress =
    applicableTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / applicableTasks.length) * 100)

  const recommendedTask = tasks.find((task) => task.status === 'pending') ?? null
  const workShift: WorkShift | null = view?.workShift ?? null

  const visibleBlocks = BLOCKS.filter((block) => {
    const hasTasks = tasks.some(
      (task) => task.block === block.key && task.status !== 'not_applicable',
    )

    if (block.key === 'development') return true
    if (block.key === 'work') return Boolean(workShift?.isWorking)
    return hasTasks
  })

  const currentBlockKey =
    recommendedTask?.block ?? visibleBlocks[0]?.key ?? 'development'

  const remainingBlocks = visibleBlocks.filter(
    (block) => block.key !== currentBlockKey,
  )

  async function refresh() {
    await loadDay()
  }

  async function handleStartDay() {
    if (!integration) return

    try {
      const next = await startDay(dateKey, {
        isTrainingDay:
          integration.training.status !== 'rest' &&
          integration.training.status !== 'omitted',
        isWorkDay: Boolean(workShift?.isWorking),
      })

      setView(next)
    } catch (startError) {
      console.error(startError)
      setError('No se ha podido iniciar el día.')
    }
  }

  async function handleTaskToggle(task: DailyRoutineTask) {
    const nextStatus: TodayTaskStatus =
      task.status === 'completed' ? 'pending' : 'completed'

    try {
      await setDailyTaskStatus(task.id, nextStatus)
      await refresh()
    } catch (taskError) {
      console.error(taskError)
      setError('No se ha podido actualizar la tarea.')
    }
  }

  async function handleStatusChange(
    task: DailyRoutineTask,
    status: TodayTaskStatus,
  ) {
    try {
      await setDailyTaskStatus(task.id, status)
      setTaskMenuId(null)
      await refresh()
    } catch (taskError) {
      console.error(taskError)
      setError('No se ha podido cambiar el estado.')
    }
  }

  async function handleDeleteOneOff(task: DailyRoutineTask) {
    try {
      await deleteOneOffTask(task.id)
      setTaskMenuId(null)
      await refresh()
    } catch (taskError) {
      console.error(taskError)
      setError('No se ha podido eliminar la tarea.')
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim()
    if (!title || !integration) return

    try {
      await addOneOffTask(
        dateKey,
        {
          block: newTaskBlock,
          title,
        },
        {
          isTrainingDay:
            integration.training.status !== 'rest' &&
            integration.training.status !== 'omitted',
          isWorkDay: Boolean(workShift?.isWorking),
        },
      )

      setNewTaskTitle('')
      setAddingTask(false)
      setOpenBlock(newTaskBlock)
      await refresh()
    } catch (taskError) {
      console.error(taskError)
      setError('No se ha podido añadir la tarea.')
    }
  }

  function renderRoutineBlock(blockKey: TodayBlock, forceOpen = false) {
    const block = BLOCKS.find((item) => item.key === blockKey)
    if (!block) return null

    const blockTasks = tasks.filter(
      (task) => task.block === block.key && task.status !== 'not_applicable',
    )
    const completed = blockTasks.filter((task) => task.status === 'completed').length
    const isOpen = forceOpen || openBlock === block.key

    return (
      <article
        key={block.key}
        className={isOpen ? 'today-block today-block--open' : 'today-block'}
      >
        <button
          type="button"
          className="today-block__header"
          onClick={() => {
            if (!forceOpen) {
              setOpenBlock(isOpen ? currentBlockKey : block.key)
            }
          }}
          aria-expanded={isOpen}
        >
          <span>{block.label}</span>
          <span className="today-block__summary">
            {block.key === 'work' && workShift?.isWorking ? (
              <>{workShift.startTime ?? '—'}–{workShift.endTime ?? '—'}</>
            ) : blockTasks.length > 0 ? (
              <>{completed}/{blockTasks.length}</>
            ) : (
              'Sin acciones'
            )}
            {!forceOpen && <span aria-hidden="true">{isOpen ? '⌃' : '›'}</span>}
          </span>
        </button>

        {isOpen && (
          <div className="today-block__body">
            {blockTasks.length === 0 ? (
              <div className="today-empty-block">
                <p>No hay acciones añadidas.</p>
                {block.key === 'development' && (
                  <button
                    type="button"
                    className="today-text-button"
                    onClick={() => {
                      setNewTaskBlock('development')
                      setAddingTask(true)
                    }}
                  >
                    + Añadir acción
                  </button>
                )}
              </div>
            ) : (
              blockTasks.map((task) => (
                <div
                  key={task.id}
                  className={`today-task today-task--${task.status}`}
                >
                  <button
                    type="button"
                    className="today-task__check"
                    aria-label={
                      task.status === 'completed'
                        ? `Desmarcar ${task.title}`
                        : `Completar ${task.title}`
                    }
                    onClick={() => void handleTaskToggle(task)}
                  >
                    <span>{getTaskStatusSymbol(task.status)}</span>
                  </button>

                  <div className="today-task__content">
                    <strong>{task.title}</strong>
                    {task.description && <span>{task.description}</span>}
                    {task.status !== 'pending' && (
                      <small>{STATUS_LABELS[task.status]}</small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="today-task__menu-button"
                    aria-label={`Opciones de ${task.title}`}
                    onClick={() =>
                      setTaskMenuId(taskMenuId === task.id ? null : task.id)
                    }
                  >
                    ···
                  </button>

                  {taskMenuId === task.id && (
                    <div className="today-task-menu">
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(task, 'pending')}
                      >
                        Pendiente
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(task, 'skipped')}
                      >
                        Omitida
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(task, 'not_applicable')}
                      >
                        No aplica
                      </button>
                      {task.kind === 'one_off' && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void handleDeleteOneOff(task)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </article>
    )
  }

  if (loading) {
    return (
      <main className="today-page">
        <div className="today-shell">
          <p className="today-loading">Preparando Hoy…</p>
        </div>
      </main>
    )
  }

  if (!view || !integration) {
    return (
      <main className="today-page">
        <div className="today-shell">
          <section className="today-error-card">
            <span>FÉNIX</span>
            <h1>Hoy no está disponible</h1>
            <p>{error ?? 'No se ha podido cargar el día.'}</p>
            <button type="button" onClick={() => void refresh()}>
              Reintentar
            </button>
          </section>
        </div>
      </main>
    )
  }

  const dayStarted = view.routine.startedAt !== null
  const nutritionMeal = integration.nutrition.nextMeal
  const priorityNutrition = Boolean(
    nutritionMeal &&
      (nutritionMeal.role === 'breakfast' ||
        (nutritionMeal.role === 'preworkout' &&
          integration.training.status === 'pending') ||
        (nutritionMeal.role === 'postworkout' &&
          (integration.training.status === 'completed' ||
            integration.training.status === 'incomplete')))
  )

  const ringStyle = {
    '--today-progress-color': progressColor(routineProgress),
    background: `conic-gradient(var(--today-progress-color) ${routineProgress}%, var(--fenix-border) ${routineProgress}% 100%)`,
  } as CSSProperties

  return (
    <main className="today-page today-page--integrated">
      <div className="today-shell">
        <header className="today-header">
          <div>
            <span className="today-brand">FÉNIX</span>
            <h1>HOY</h1>
            <p>{formatTodayDate(dateKey)}</p>
          </div>
        </header>

        {error && <div className="today-inline-error" role="alert">{error}</div>}

        {!dayStarted ? (
          <section className="today-start-card">
            <img src="/fenix-icon-192.png" alt="" className="today-start-card__icon" />
            <div>
              <span className="today-eyebrow">HOY</span>
              <h2>Tu día está preparado</h2>
              <p>
                Training, Nutrition y Progreso ya están conectados. Iniciar el día activa la rutina sin inventar cumplimiento.
              </p>
            </div>
            <button type="button" className="today-primary-button" onClick={() => void handleStartDay()}>
              Iniciar día
            </button>
          </section>
        ) : (
          <>
            <section className="today-hero today-hero--integrated">
              <div className="today-hero__progress">
                <div className="today-progress-ring" style={ringStyle}>
                  <div className="today-progress-ring__inner">
                    <strong>{routineProgress}%</strong>
                    <span>rutina</span>
                  </div>
                </div>
                <div className="today-hero__numbers">
                  <strong>{completedTasks.length}/{applicableTasks.length}</strong>
                  <span>acciones de hoy</span>
                </div>
              </div>

              <div className="today-now-card today-now-card--integrated">
                <span className="today-eyebrow">AHORA</span>

                {integration.training.status === 'in_progress' ? (
                  <>
                    <h2>{integration.training.title}</h2>
                    <p>Entrenamiento en curso</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={onOpenTraining}
                    >
                      Continuar entrenamiento
                    </button>
                  </>
                ) : priorityNutrition && nutritionMeal ? (
                  <>
                    <h2>{nutritionMeal.roleLabel}</h2>
                    <p>{nutritionMeal.name}</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={onOpenNutrition}
                    >
                      Abrir Nutrition
                    </button>
                  </>
                ) : recommendedTask ? (
                  <>
                    <h2>{recommendedTask.title}</h2>
                    {recommendedTask.description && <p>{recommendedTask.description}</p>}
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={() => void handleTaskToggle(recommendedTask)}
                    >
                      Completar
                    </button>
                  </>
                ) : nutritionMeal ? (
                  <>
                    <h2>{nutritionMeal.roleLabel}</h2>
                    <p>{nutritionMeal.name}</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      onClick={onOpenNutrition}
                    >
                      Abrir Nutrition
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Día resuelto</h2>
                    <p>No quedan acciones locales ni comidas pendientes.</p>
                  </>
                )}
              </div>
            </section>

            <section className="today-section today-current-block">
              <div className="today-section-heading">
                <div>
                  <span className="today-eyebrow">RUTINA · BLOQUE ACTUAL</span>
                  <h2>{BLOCKS.find((item) => item.key === currentBlockKey)?.label ?? 'Tu día'}</h2>
                </div>
                <button
                  type="button"
                  className="today-text-button"
                  onClick={() => setAddingTask((current) => !current)}
                >
                  + Añadir para hoy
                </button>
              </div>

              {addingTask && (
                <div className="today-add-task">
                  <input
                    type="text"
                    value={newTaskTitle}
                    placeholder="Nueva acción"
                    aria-label="Nombre de la nueva acción"
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                  />
                  <select
                    value={newTaskBlock}
                    aria-label="Bloque de la nueva acción"
                    onChange={(event) => setNewTaskBlock(event.target.value as TodayBlock)}
                  >
                    {BLOCKS.map((block) => (
                      <option key={block.key} value={block.key}>{block.label}</option>
                    ))}
                  </select>
                  <div className="today-add-task__actions">
                    <button type="button" className="today-secondary-button" onClick={() => setAddingTask(false)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      disabled={newTaskTitle.trim().length === 0}
                      onClick={() => void handleAddTask()}
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              )}

              <div className="today-block-list">
                {renderRoutineBlock(currentBlockKey, true)}
              </div>
            </section>

            <section className="today-dashboard-grid" aria-label="Resumen de módulos">
              <button
                type="button"
                className="today-dashboard-card today-dashboard-card--training"
                onClick={onOpenTraining}
              >
                <span className="today-dashboard-card__eyebrow">TRAINING</span>
                <strong>{integration.training.title}</strong>
                <small>
                  {integration.training.completedThisWeek}/{integration.training.plannedThisWeek} semana
                  {' · '}racha {integration.training.streak}
                  {integration.training.streakPending ? ' pendiente' : ''}
                </small>
                <b>{integration.training.status === 'in_progress' ? 'Continuar' : 'Abrir'} ›</b>
              </button>

              <button
                type="button"
                className="today-dashboard-card today-dashboard-card--nutrition"
                onClick={onOpenNutrition}
              >
                <span className="today-dashboard-card__eyebrow">NUTRITION</span>
                <strong>{nutritionMeal ? nutritionMeal.roleLabel : 'Día resuelto'}</strong>
                <small>
                  {formatNumber(integration.nutrition.consumed.calories)} kcal
                  {' · '}P {formatNumber(integration.nutrition.consumed.protein)} g
                </small>
                <b>Abrir ›</b>
              </button>

              <button
                type="button"
                className="today-dashboard-card today-dashboard-card--progress"
                onClick={onOpenProgress}
              >
                <span className="today-dashboard-card__eyebrow">PROGRESO</span>
                <strong>{weightPrimary(integration.progress)}</strong>
                <small>
                  Rutina{' '}
                  {integration.progress.routine.adherencePercent === null
                    ? '—'
                    : `${integration.progress.routine.adherencePercent}%`}
                </small>
                <b>Ver ›</b>
              </button>
            </section>

            {remainingBlocks.length > 0 && (
              <section className="today-section today-rest-of-day">
                <div className="today-section-heading">
                  <div>
                    <span className="today-eyebrow">DESPUÉS</span>
                    <h2>Resto del día</h2>
                  </div>
                </div>
                <div className="today-block-list">
                  {remainingBlocks.map((block) => renderRoutineBlock(block.key))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default TodayPage
