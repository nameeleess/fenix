import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { db } from '../../db/database'
import { createLatestWinsGate } from '../../app/latestWins'
import type {
  DailyRoutineTask,
  TodayBlock,
  TodayTaskStatus,
  WorkShift,
} from '../../types/today'
import {
  addOneOffTask,
  deleteOneOffTask,
  promoteOneOffTaskToRoutine,
  reconcileDailyRoutineForLoad,
  getDailyRoutineView,
  setDailyTaskStatus,
  startDay,
  upsertWorkShift,
  setWorkShiftStatus,
  type DailyRoutineView,
} from './todayService'
import { AppHeader } from '../../components/designSystem'
import { SectionIcon } from '../../components/SectionIcon'

import {
  getTodayIntegrationSummary,
  type TodayIntegrationSummary,
} from './todayIntegrationService'

import './today.css'
import './today-integration.css'

interface TodayPageProps {
  isActive: boolean
  dateKey: string
  refreshRevision: number
  onOpenTraining: () => void
  onOpenNutrition: () => void
  onOpenProgress: () => void
  onOpenSettings: () => void
  onOpenRoutineSettings: () => void
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

function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)
}

function getTaskStatusSymbol(status: TodayTaskStatus) {
  if (status === 'completed') return '✓'
  if (status === 'skipped') return ''
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
  dateKey,
  refreshRevision,
  onOpenTraining,
  onOpenNutrition,
  onOpenProgress,
  onOpenSettings,
  onOpenRoutineSettings,
}: TodayPageProps) {
  const [view, setView] = useState<DailyRoutineView | null>(null)
  const [integration, setIntegration] = useState<TodayIntegrationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openBlock, setOpenBlock] = useState<TodayBlock | null>('morning')
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskBlock, setNewTaskBlock] = useState<TodayBlock>('development')
  const [workDraft, setWorkDraft] = useState<{ key: string; start: string; end: string } | null>(null)
  const [workBusy, setWorkBusy] = useState(false)
  const loadCausality = useRef(createLatestWinsGate())

  const loadDay = useCallback(async () => {
    const token = loadCausality.current.begin()
    const isCurrent = () => loadCausality.current.isCurrent(token)

    try {
      setError(null)

      const [moduleSummary, existingShift] = await Promise.all([
        getTodayIntegrationSummary(dateKey),
        db.workShifts.where('date').equals(dateKey).first(),
      ])

      if (!isCurrent()) {
        return
      }

      const isTrainingDay =
        moduleSummary.training.status !== 'rest' &&
        moduleSummary.training.status !== 'omitted'

      const isWorkDay = Boolean(
        existingShift &&
          existingShift.deletedAt === null &&
          existingShift.isWorking,
      )

      const persisted = await reconcileDailyRoutineForLoad(
        dateKey,
        {
          isTrainingDay,
          isWorkDay,
        },
        isCurrent,
      )

      if (!persisted || !isCurrent()) {
        return
      }

      const nextView = await getDailyRoutineView(dateKey)

      if (!isCurrent()) {
        return
      }

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

      if (isCurrent()) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se ha podido cargar el día.',
        )
      }
    } finally {
      if (isCurrent()) {
        setLoading(false)
      }
    }
  }, [dateKey])

  useEffect(() => {
    if (!isActive) return

    const timer = window.setTimeout(() => {
      setLoading(true)
      void loadDay()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isActive, loadDay, refreshRevision])

  const tasks = view?.tasks ?? []

  async function saveWorkShift(isWorking: boolean) {
    setWorkBusy(true)
    try {
      await upsertWorkShift(dateKey, {
        isWorking,
        startTime: isWorking ? workStart || null : null,
        endTime: isWorking ? workEnd || null : null,
      })
      await refresh()
    } catch (shiftError) {
      setError(shiftError instanceof Error ? shiftError.message : 'No se ha podido actualizar la jornada.')
    } finally { setWorkBusy(false) }
  }

  async function changeWorkStatus(status: 'pending' | 'completed' | 'skipped') {
    setWorkBusy(true)
    try { await setWorkShiftStatus(dateKey, status); await refresh() }
    catch (shiftError) { setError(shiftError instanceof Error ? shiftError.message : 'No se ha podido actualizar la jornada.') }
    finally { setWorkBusy(false) }
  }

  const applicableTasks = tasks.filter((task) => task.status !== 'not_applicable')
  const completedTasks = applicableTasks.filter((task) => task.status === 'completed')
  const routineProgress =
    applicableTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / applicableTasks.length) * 100)

  const recommendedTask = tasks.find((task) => task.status === 'pending')
    ?? tasks.find((task) => task.status === 'completed')
    ?? null
  const workShift: WorkShift | null = view?.workShift ?? null
  const workShiftDraftKey = `${dateKey}:${workShift?.id ?? 'none'}:${workShift?.updatedAt ?? 'none'}`
  const workStart = workDraft?.key === workShiftDraftKey
    ? workDraft.start
    : workShift?.startTime ?? ''
  const workEnd = workDraft?.key === workShiftDraftKey
    ? workDraft.end
    : workShift?.endTime ?? ''

  function updateWorkStart(value: string) {
    setWorkDraft((current) => ({
      key: workShiftDraftKey,
      start: value,
      end: current?.key === workShiftDraftKey
        ? current.end
        : workShift?.endTime ?? '',
    }))
  }

  function updateWorkEnd(value: string) {
    setWorkDraft((current) => ({
      key: workShiftDraftKey,
      start: current?.key === workShiftDraftKey
        ? current.start
        : workShift?.startTime ?? '',
      end: value,
    }))
  }

  const visibleBlocks = BLOCKS.filter((block) => {
    const hasTasks = tasks.some(
      (task) => task.block === block.key && task.status !== 'not_applicable',
    )

    if (block.key === 'development') return true
    if (block.key === 'work') return hasTasks && Boolean(workShift?.isWorking)
    return hasTasks
  })


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

  async function handlePromoteOneOff(task: DailyRoutineTask) {
    try {
      await promoteOneOffTaskToRoutine(task.id)
      setTaskMenuId(null)
    } catch (taskError) {
      console.error(taskError)
      setError('No se ha podido guardar la tarea en la rutina.')
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

  function renderRoutineBlock(blockKey: TodayBlock) {
    const block = BLOCKS.find((item) => item.key === blockKey)
    if (!block) return null

    const blockTasks = tasks.filter(
      (task) => task.block === block.key && task.status !== 'not_applicable',
    )
    const completed = blockTasks.filter((task) => task.status === 'completed').length
    const isOpen = openBlock === block.key

    return (
      <article
        key={block.key}
        className={isOpen ? 'today-block today-block--open' : 'today-block'}
      >
        <button
          type="button"
          className="today-block__header"
          onClick={() => {
            setOpenBlock(isOpen ? null : block.key)
          }}
          aria-expanded={isOpen}
        >
          <SectionIcon name={block.key === 'morning' ? 'routine' : block.key === 'night' ? 'moon' : block.key === 'work' ? 'work' : 'energy'} />
          <span className="today-block__title">{block.label.toLocaleLowerCase('es-ES')}<small>{completed}/{blockTasks.length} {completed === 1 ? 'completada' : 'completadas'}</small></span>
          <span className="today-block__summary">
            {block.key === 'work' && workShift?.isWorking ? (
              <>{workShift.startTime ?? '—'}–{workShift.endTime ?? '—'}</>
            ) : blockTasks.length > 0 ? (
              <>{completed}/{blockTasks.length}</>
            ) : (
              'Sin acciones'
            )}
            <span aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
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
                        <>
                          <button
                            type="button"
                            onClick={() => void handlePromoteOneOff(task)}
                          >
                            Guardar en rutina
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void handleDeleteOneOff(task)}
                          >
                            Eliminar
                          </button>
                        </>
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
    background: `conic-gradient(#ffac23 0%, #9fcc1b ${routineProgress * .45}%, #30b92d ${routineProgress * .65}%, #ff1426 ${routineProgress}%, var(--fenix-border) ${routineProgress}% 100%)`,
  } as CSSProperties

  const moduleDashboard = (
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
          {integration.training.hasMultipleSessions
            ? ` · ${integration.training.sessionCount} sesiones hoy`
            : ''}
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
  )

  return (
    <main className="today-page today-page--integrated">
      <div className="today-shell">
        <AppHeader title="Hoy" dateKey={dateKey} onSettings={onOpenSettings} />

        {error && <div className="today-inline-error" role="alert">{error}</div>}

        {!dayStarted ? (
          <>
          <section className="today-start-card">
            <span className="today-start-card__icon"><SectionIcon name="routine" /></span>
            <div>
              <h2>Tu día está preparado</h2>
              <p>Todo en cero. Un nuevo día,<br/>las mismas oportunidades.</p>
              <button type="button" className="today-primary-button" onClick={() => void handleStartDay()}>
                <SectionIcon name="play" /> Comenzar mi día
              </button>
            </div>
          </section>
            <div className="today-day-zero-settings">
              <button type="button" onClick={onOpenRoutineSettings}><SectionIcon name="work"/><span><strong>Configura tu horario laboral</strong><small>Define tu jornada para adaptar la rutina.</small></span><SectionIcon name="chevron"/></button>
              <button type="button" onClick={onOpenRoutineSettings}><SectionIcon name="target"/><span><strong>Prepara tu rutina del día</strong><small>Añade tus tareas y enfoca tu sesión.</small></span><SectionIcon name="chevron"/></button>
            </div>
            <section className="today-start-empty"><span className="today-eyebrow">TU DÍA</span><div><i/><span><strong>Aún no hay pasos completados</strong><small>Tu día comienza aquí.<br/>Completa tu primera tarea para ver tu progreso.</small></span><SectionIcon name="chevron"/></div></section>
            <p className="today-day-zero-quote">“Disciplina hoy, resultados mañana.”</p>
            <section className="today-day-zero-modules">
              <button type="button" onClick={onOpenTraining}><span>TRAINING</span><strong>Listo para empezar</strong><small>Tu sesión te espera.</small><b><SectionIcon name="play"/> Iniciar</b></button>
              <button type="button" onClick={onOpenNutrition}><span>NUTRITION</span><strong>Empieza tu plan</strong><small>Registra tu primera comida del día.</small><b><SectionIcon name="play"/> Registrar</b></button>
              <button type="button" onClick={onOpenProgress}><span>PROGRESO</span><strong>Día 0</strong><small>Todo comienza aquí.</small><b><SectionIcon name="play"/> Ver métricas</b></button>
            </section>
          </>
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
                  <span>tareas locales</span><small>Rutina del día</small>
                </div>
              </div>

              <div className="today-now-card today-now-card--integrated">
                <span className="today-eyebrow">AHORA</span>
                <SectionIcon name={recommendedTask ? 'routine' : priorityNutrition ? 'nutrition' : 'routine'} />

                {integration.training.status === 'in_progress' ? (
                  <>
                    <h2>{integration.training.title}</h2>
                    <p>Entrenamiento en curso</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      aria-label="Continuar entrenamiento"
                      onClick={onOpenTraining}
                    >
                      ›
                    </button>
                  </>
                ) : recommendedTask ? (
                  <>
                    <h2>{recommendedTask.title}</h2>
                    {recommendedTask.description && <p>{recommendedTask.description}</p>}
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      aria-label={recommendedTask.status === 'completed' ? 'Reabrir tarea' : 'Completar'}
                      onClick={() => void handleTaskToggle(recommendedTask)}
                    >
                      ✓
                    </button>
                  </>
                ) : priorityNutrition && nutritionMeal ? (
                  <>
                    <h2>{nutritionMeal.roleLabel}</h2>
                    <p>{nutritionMeal.name}</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      aria-label="Abrir Nutrition"
                      onClick={onOpenNutrition}
                    >
                      ›
                    </button>
                  </>
                ) : nutritionMeal ? (
                  <>
                    <h2>{nutritionMeal.roleLabel}</h2>
                    <p>{nutritionMeal.name}</p>
                    <button
                      type="button"
                      className="today-primary-button today-primary-button--compact"
                      aria-label="Abrir Nutrition"
                      onClick={onOpenNutrition}
                    >
                      ›
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

            <section className="today-workshift-card" aria-label="Jornada laboral">
              <details>
              <summary><SectionIcon name="work" /><div><strong>{workShift?.isWorking ? 'Horario laboral configurado' : 'Día libre'}</strong><span>{workShift?.isWorking ? 'La rutina del día se adapta a tu jornada.' : 'Sin jornada laboral'}</span></div><span aria-hidden="true">›</span></summary>
              <div className="today-section-heading">
                <div><span className="today-eyebrow">JORNADA</span><h2>{workShift?.isWorking ? 'Día de trabajo' : 'Día libre'}</h2></div>
                <div className="today-workshift-card__mode" role="group" aria-label="Tipo de jornada">
                  <button type="button" className={workShift?.isWorking ? 'active' : ''} disabled={workBusy} onClick={() => void saveWorkShift(true)}>Trabajo</button>
                  <button type="button" className={workShift && !workShift.isWorking ? 'active' : ''} disabled={workBusy} onClick={() => void saveWorkShift(false)}>Libre</button>
                </div>
              </div>
              {workShift?.isWorking ? (
                <div className="today-workshift-card__details">
                  <label><span>Entrada</span><input type="time" value={workStart} onChange={(event) => updateWorkStart(event.target.value)} /></label>
                  <label><span>Salida</span><input type="time" value={workEnd} onChange={(event) => updateWorkEnd(event.target.value)} /></label>
                  <button type="button" disabled={workBusy} onClick={() => void saveWorkShift(true)}>Guardar horario</button>
                  <div className="today-workshift-card__status">
                    <button type="button" className={workShift.status === 'pending' ? 'active' : ''} onClick={() => void changeWorkStatus('pending')}>Pendiente</button>
                    <button type="button" className={workShift.status === 'completed' ? 'active' : ''} onClick={() => void changeWorkStatus('completed')}>Hecha</button>
                    <button type="button" className={workShift.status === 'skipped' ? 'active' : ''} onClick={() => void changeWorkStatus('skipped')}>Omitida</button>
                  </div>
                </div>
              ) : <p>Hoy no tienes una jornada de trabajo configurada.</p>}
              </details>
            </section>

            <section className="today-section today-current-block">
              <div className="today-section-heading">
                <div>
                  <span className="today-eyebrow">TU DÍA</span>
                </div>
                <div className="today-section-heading__actions">
                  <button
                    type="button"
                    className="today-text-button"
                    onClick={onOpenRoutineSettings}
                  >
                    Editar rutina
                  </button>
                  <button
                    type="button"
                    className="today-text-button"
                    onClick={() => setAddingTask((current) => !current)}
                  >
                    + Añadir para hoy
                  </button>
                </div>
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
                {visibleBlocks.map(block => renderRoutineBlock(block.key))}
              </div>
            </section>

            {moduleDashboard}

          </>
        )}

      </div>
    </main>
  )
}

export default TodayPage
