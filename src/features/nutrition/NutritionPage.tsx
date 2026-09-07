import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import type {
  AppetiteMode,
  NutritionRole,
} from '../../types/nutrition'

import NutritionLibrary from './NutritionLibrary'
import RecipeVisual from './RecipeVisual'

import {
  addImprovisedMeal,
  applyNutritionWeek,
  getLocalDateKey,
  getNutritionDay,
  getNutritionWeekSuggestion,
  getRelevantNutritionMeal,
  nutritionRoleLabel,
  replaceDailyMealRecipe,
  setDailyMealPortion,
  setDailyMealStatus,
  setNutritionDayAppetite,
  updateNutritionGoal,
  type MacroSummary,
  type NutritionDayView,
  type NutritionGoalInput,
  type NutritionMealView,
  type NutritionWeekSuggestion,
} from './nutritionVNextService'

import './nutrition-vnext.css'

type NutritionTab =
  | 'today'
  | 'week'
  | 'library'

const appetiteOptions: Array<{
  value: AppetiteMode
  label: string
  detail: string
}> = [
  {
    value: 'compact',
    label: 'Compacto',
    detail: 'Menos volumen',
  },
  {
    value: 'normal',
    label: 'Normal',
    detail: 'Equilibrado',
  },
  {
    value: 'voluminous',
    label: 'Voluminoso',
    detail: 'Más volumen',
  },
]

const portionOptions = [0.5, 1, 1.5, 2]

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function shiftDate(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return getLocalDateKey(date)
}

function formatDate(dateKey: string, withWeekday = true) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
  }).format(parseDateKey(dateKey))
}

function shortDate(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
  }).format(parseDateKey(dateKey))
}

function number(value: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 1,
  }).format(value)
}

function macroText(value: number, unit: string) {
  return `${number(value)} ${unit}`
}

function statusLabel(status: NutritionMealView['meal']['status']) {
  if (status === 'completed') return 'Realizada'
  if (status === 'skipped') return 'Omitida'
  return 'Pendiente'
}

function roleTone(role: NutritionRole) {
  if (role === 'preworkout') return 'pre'
  if (role === 'postworkout') return 'post'
  return 'default'
}

function MacroOverview({
  consumed,
  planned,
  target,
}: {
  consumed: MacroSummary
  planned: MacroSummary
  target: NutritionDayView['goal']
}) {
  const caloriesTarget = target?.targetCalories ?? null
  const proteinTarget = target?.targetProtein ?? null

  const caloriePct = caloriesTarget
    ? Math.min(100, Math.round((consumed.calories / caloriesTarget) * 100))
    : 0
  const proteinPct = proteinTarget
    ? Math.min(100, Math.round((consumed.protein / proteinTarget) * 100))
    : 0

  return (
    <section className="nutrition-vnext-macros">
      <div className="nutrition-vnext-macroHero">
        <div>
          <span>Consumido</span>
          <strong>{number(consumed.calories)} kcal</strong>
          <small>
            de {caloriesTarget ? `${number(caloriesTarget)} kcal objetivo` : 'objetivo sin definir'}
          </small>
        </div>
        <div className="nutrition-vnext-macroHero__planned">
          <span>Planificado</span>
          <strong>{number(planned.calories)}</strong>
          <small>kcal</small>
        </div>
      </div>

      <div className="nutrition-vnext-progressLine">
        <span style={{ width: `${caloriePct}%` }} />
      </div>

      <div className="nutrition-vnext-macroGrid">
        <article>
          <span>Proteína</span>
          <strong>{macroText(consumed.protein, 'g')}</strong>
          <small>{proteinTarget ? `de ${number(proteinTarget)} g` : 'sin objetivo'}</small>
          <div className="nutrition-vnext-progressLine small">
            <span style={{ width: `${proteinPct}%` }} />
          </div>
        </article>
        <article>
          <span>Carbohidratos</span>
          <strong>{macroText(consumed.carbs, 'g')}</strong>
          <small>plan {macroText(planned.carbs, 'g')}</small>
        </article>
        <article>
          <span>Grasas</span>
          <strong>{macroText(consumed.fat, 'g')}</strong>
          <small>plan {macroText(planned.fat, 'g')}</small>
        </article>
      </div>

      {(consumed.hasUnknown || planned.hasUnknown) && (
        <p className="nutrition-vnext-qualityNote">
          Hay datos nutricionales parciales. FÉNIX no los interpreta como cero.
        </p>
      )}
    </section>
  )
}

function MealCard({
  item,
  onComplete,
  onSkip,
  onUndo,
  onReplace,
  onPortion,
  trainingSessionName,
}: {
  item: NutritionMealView
  trainingSessionName?: string | null
  onComplete: () => Promise<void>
  onSkip: () => Promise<void>
  onUndo: () => Promise<void>
  onReplace: (recipeId: string) => Promise<void>
  onPortion: (portion: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const meal = item.meal
  const disabled = meal.status !== 'pending'

  return (
    <article
      className={`nutrition-vnext-meal nutrition-vnext-meal--${roleTone(meal.role)} nutrition-vnext-meal--${meal.status}`}
    >
      <button
        className="nutrition-vnext-meal__head"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="nutrition-vnext-meal__order">{meal.order}</span>
        <RecipeVisual recipe={item.recipe} role={meal.role} name={meal.name} />
        <span className="nutrition-vnext-meal__title">
          <small>{nutritionRoleLabel(meal.role)}</small>
          <strong>{meal.name}</strong>
          <em>{statusLabel(meal.status)}</em>
        </span>
        <span className="nutrition-vnext-meal__kcal">
          {meal.plannedCalories === null ? '—' : `${number(meal.plannedCalories)} kcal`}
        </span>
        <span className="nutrition-vnext-chevron">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="nutrition-vnext-meal__body">
          <div className="nutrition-vnext-meal__macroRow">
            <span>P {meal.plannedProtein === null ? '—' : `${number(meal.plannedProtein)} g`}</span>
            <span>C {meal.plannedCarbs === null ? '—' : `${number(meal.plannedCarbs)} g`}</span>
            <span>G {meal.plannedFat === null ? '—' : `${number(meal.plannedFat)} g`}</span>
          </div>

          {meal.trainingSessionId && (
            <p className="nutrition-vnext-linkNote">
              Vinculada a {trainingSessionName ?? 'su sesión de Training'}. Si se reprograma, las comidas pendientes asociadas se trasladan con ella.
            </p>
          )}

          <div className="nutrition-vnext-portionGroup">
            <span>Porción</span>
            <div>
              {portionOptions.map((portion) => (
                <button
                  key={portion}
                  type="button"
                  disabled={disabled}
                  className={meal.portionMultiplier === portion ? 'active' : ''}
                  onClick={() => void onPortion(portion)}
                >
                  {portion}×
                </button>
              ))}
            </div>
          </div>

          {item.alternatives.length > 0 && (
            <label className="nutrition-vnext-selectLabel">
              <span>Sustituir por</span>
              <select
                disabled={disabled}
                value={meal.recipeId ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    void onReplace(event.target.value)
                  }
                }}
              >
                {meal.recipeId === null && <option value="">Sin receta</option>}
                {item.alternatives.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}{recipe.isFavorite ? ' · ★' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="nutrition-vnext-meal__actions">
            {meal.status === 'pending' ? (
              <>
                <button className="primary" type="button" onClick={() => void onComplete()}>
                  Confirmar realizada
                </button>
                <button type="button" onClick={() => void onSkip()}>
                  Omitir
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void onUndo()}>
                Volver a pendiente
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function ImprovisedMealModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: {
    submissionId: string
    name: string
    role: NutritionRole
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<NutritionRole>('extra')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [submissionId] = useState(() => crypto.randomUUID())

  function optional(value: string) {
    const trimmed = value.replace(',', '.').trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Los macros deben ser números válidos.')
    }
    return parsed
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    try {
      await onSave({
        submissionId,
        name,
        role,
        calories: optional(calories),
        protein: optional(protein),
        carbs: optional(carbs),
        fat: optional(fat),
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar.')
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="nutrition-vnext-modalBackdrop" role="presentation">
      <form className="nutrition-vnext-modal" onSubmit={submit}>
        <div className="nutrition-vnext-modal__head">
          <div>
            <small>REGISTRO MANUAL</small>
            <h2>Comida improvisada</h2>
          </div>
          <button type="button" disabled={submitting} onClick={onClose}>×</button>
        </div>

        {error && <div className="nutrition-vnext-error">{error}</div>}

        <label>
          <span>Nombre</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Bocadillo de pavo" />
        </label>

        <label>
          <span>Momento</span>
          <select value={role} onChange={(event) => setRole(event.target.value as NutritionRole)}>
            {(['breakfast', 'preworkout', 'postworkout', 'main_meal', 'snack', 'dinner', 'extra'] as NutritionRole[]).map((item) => (
              <option key={item} value={item}>{nutritionRoleLabel(item)}</option>
            ))}
          </select>
        </label>

        <div className="nutrition-vnext-modal__macroInputs">
          <label><span>kcal</span><input inputMode="decimal" value={calories} onChange={(event) => setCalories(event.target.value)} /></label>
          <label><span>Proteína</span><input inputMode="decimal" value={protein} onChange={(event) => setProtein(event.target.value)} /></label>
          <label><span>Carbos</span><input inputMode="decimal" value={carbs} onChange={(event) => setCarbs(event.target.value)} /></label>
          <label><span>Grasas</span><input inputMode="decimal" value={fat} onChange={(event) => setFat(event.target.value)} /></label>
        </div>

        <p className="nutrition-vnext-qualityNote">
          Puedes dejar macros vacíos. FÉNIX los mantendrá como desconocidos, no como cero.
        </p>

        <div className="nutrition-vnext-modal__actions">
          <button type="button" disabled={submitting} onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit" disabled={submitting}>{submitting ? 'Guardando…' : 'Guardar como realizada'}</button>
        </div>
      </form>
    </div>
  )
}

function GoalEditor({
  current,
  onClose,
  onSave,
}: {
  current: NutritionDayView['goal']
  onClose: () => void
  onSave: (input: NutritionGoalInput) => Promise<void>
}) {
  const [calories, setCalories] = useState(current?.targetCalories?.toString() ?? '')
  const [protein, setProtein] = useState(current?.targetProtein?.toString() ?? '')
  const [carbs, setCarbs] = useState(current?.targetCarbs?.toString() ?? '')
  const [fat, setFat] = useState(current?.targetFat?.toString() ?? '')
  const [rateMin, setRateMin] = useState(current?.targetWeightGainMinKgPerWeek?.toString() ?? '')
  const [rateMax, setRateMax] = useState(current?.targetWeightGainMaxKgPerWeek?.toString() ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  function optional(value: string) {
    const trimmed = value.replace(',', '.').trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Introduce valores válidos.')
    return parsed
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      await onSave({
        targetCalories: optional(calories),
        targetProtein: optional(protein),
        targetCarbs: optional(carbs),
        targetFat: optional(fat),
        targetWeightGainMinKgPerWeek: optional(rateMin),
        targetWeightGainMaxKgPerWeek: optional(rateMax),
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar.')
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="nutrition-vnext-modalBackdrop" role="presentation">
      <form className="nutrition-vnext-modal" onSubmit={submit}>
        <div className="nutrition-vnext-modal__head">
          <div>
            <small>OBJETIVO ACTIVO</small>
            <h2>Objetivos Nutrition</h2>
          </div>
          <button type="button" disabled={submitting} onClick={onClose}>×</button>
        </div>
        {error && <div className="nutrition-vnext-error">{error}</div>}
        <div className="nutrition-vnext-modal__macroInputs two">
          <label><span>kcal/día</span><input inputMode="decimal" value={calories} onChange={(event) => setCalories(event.target.value)} /></label>
          <label><span>Proteína g/día</span><input inputMode="decimal" value={protein} onChange={(event) => setProtein(event.target.value)} /></label>
          <label><span>Carbohidratos g/día</span><input inputMode="decimal" value={carbs} onChange={(event) => setCarbs(event.target.value)} placeholder="Opcional" /></label>
          <label><span>Grasas g/día</span><input inputMode="decimal" value={fat} onChange={(event) => setFat(event.target.value)} placeholder="Opcional" /></label>
          <label><span>Ganancia mín. kg/sem</span><input inputMode="decimal" value={rateMin} onChange={(event) => setRateMin(event.target.value)} placeholder="Sin definir" /></label>
          <label><span>Ganancia máx. kg/sem</span><input inputMode="decimal" value={rateMax} onChange={(event) => setRateMax(event.target.value)} placeholder="Sin definir" /></label>
        </div>
        <p className="nutrition-vnext-qualityNote">
          Guardar crea una nueva vigencia. El objetivo anterior se conserva como histórico.
        </p>
        <div className="nutrition-vnext-modal__actions">
          <button type="button" disabled={submitting} onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit" disabled={submitting}>{submitting ? 'Guardando…' : 'Guardar objetivo'}</button>
        </div>
      </form>
    </div>
  )
}

function WeekView({
  week,
  onPrevious,
  onNext,
  preferredDate,
  onApply,
}: {
  week: NutritionWeekSuggestion
  preferredDate: string
  onPrevious: () => void
  onNext: () => void
  onApply: () => Promise<void>
}) {
  const initialDate = week.days.some((day) => day.date === preferredDate)
    ? preferredDate
    : week.days[0]?.date ?? week.monday
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const effectiveSelectedDate = week.days.some((day) => day.date === selectedDate)
    ? selectedDate
    : initialDate
  const selected = week.days.find((day) => day.date === effectiveSelectedDate) ?? week.days[0]

  return (
    <div className="nutrition-vnext-week">
      <div className="nutrition-vnext-week__toolbar">
        <button type="button" onClick={onPrevious}>‹</button>
        <div className="nutrition-vnext-week__label">
          <small>SEMANA</small>
          <strong>Desde {formatDate(week.monday, false)}</strong>
        </div>
        <button type="button" onClick={onNext}>›</button>
      </div>

      <div className="nutrition-vnext-week__days">
        {week.days.map((day) => (
          <button
            type="button"
            key={day.date}
            className={day.date === selected?.date ? 'active' : ''}
            onClick={() => setSelectedDate(day.date)}
          >
            <span>{shortDate(day.date).split(' ')[0]}</span>
            <strong>{parseDateKey(day.date).getDate()}</strong>
            <i className={day.trainingSessions.length > 0 ? 'training' : ''} />
          </button>
        ))}
      </div>

      {selected && (
        <section className="nutrition-vnext-week__selected">
          <div className="nutrition-vnext-sectionHead">
            <div>
              <small>
                {selected.trainingSessions.length > 0
                  ? `${selected.trainingSessions.length} SESIÓN${selected.trainingSessions.length === 1 ? '' : 'ES'} TRAINING`
                  : 'DÍA SIN TRAINING'}
              </small>
              <h2>{formatDate(selected.date)}</h2>
            </div>
            <span>{number(selected.planned.calories)} kcal plan</span>
          </div>

          <div className="nutrition-vnext-week__mealList">
            {selected.meals.map((meal) => {
              const linkedSession = meal.trainingSessionId
                ? selected.trainingSessions.find((session) => session.id === meal.trainingSessionId) ?? null
                : null

              return (
              <article key={`${selected.date}-${meal.role}-${meal.trainingSessionId ?? 'day'}`} className="nutrition-vnext-weekMeal">
                <RecipeVisual
                  recipe={meal.recipe}
                  role={meal.role}
                  name={meal.recipe?.name ?? nutritionRoleLabel(meal.role)}
                />
                <span>
                  {nutritionRoleLabel(meal.role)}
                  {linkedSession ? ` · ${linkedSession.templateName}` : ''}
                </span>
                <strong>{meal.recipe?.name ?? 'Sin propuesta compatible'}</strong>
                <small>
                  {meal.recipe?.estimatedCalories === null || meal.recipe?.estimatedCalories === undefined
                    ? 'Macros parciales'
                    : `${number(meal.recipe.estimatedCalories)} kcal`}
                </small>
              </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="nutrition-vnext-week__apply">
        <div>
          <strong>Semana sugerida flexible</strong>
          <span>Aplicar reemplaza solo comidas pendientes. Nunca reescribe realizadas u omitidas.</span>
        </div>
        <button className="primary" type="button" onClick={() => void onApply()}>
          Aplicar semana
        </button>
      </div>
    </div>
  )
}

interface NutritionPageProps {
  isActive: boolean
  refreshRevision: number
}

export default function NutritionPage({
  isActive,
  refreshRevision,
}: NutritionPageProps) {
  const [tab, setTab] = useState<NutritionTab>('today')
  const [date, setDate] = useState(getLocalDateKey())
  const [weekAnchor, setWeekAnchor] = useState(getLocalDateKey())
  const [day, setDay] = useState<NutritionDayView | null>(null)
  const [week, setWeek] = useState<NutritionWeekSuggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showImprovised, setShowImprovised] = useState(false)
  const [showGoal, setShowGoal] = useState(false)

  const nextPending = useMemo(
    () => (day ? getRelevantNutritionMeal(day) : null),
    [day],
  )

  useEffect(() => {
    if (!isActive || tab !== 'today') return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)

      void getNutritionDay(date)
        .then((value) => {
          if (!active) return
          setDay(value)
          setLoading(false)
          setError('')
        })
        .catch((loadError: unknown) => {
          if (!active) return
          setError(loadError instanceof Error ? loadError.message : 'No se ha podido cargar Nutrition.')
          setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [date, isActive, refreshRevision, tab])

  useEffect(() => {
    if (!isActive || tab !== 'week') return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)

      void getNutritionWeekSuggestion(weekAnchor)
        .then((value) => {
          if (!active) return
          setWeek(value)
          setLoading(false)
          setError('')
        })
        .catch((loadError: unknown) => {
          if (!active) return
          setError(loadError instanceof Error ? loadError.message : 'No se ha podido cargar la semana.')
          setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [isActive, refreshRevision, tab, weekAnchor])

  async function refreshDay(action: () => Promise<NutritionDayView>, success?: string) {
    try {
      const value = await action()
      setDay(value)
      setError('')
      if (success) setMessage(success)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se ha podido completar la acción.')
    }
  }

  function changeTab(next: NutritionTab) {
    if (next === 'week') {
      // Open the week that contains the day the user is currently viewing.
      // Do not jump back to the app's initial/current date implicitly.
      setWeekAnchor(date)
    }

    setLoading(next !== 'library')
    setMessage('')
    setError('')
    setTab(next)
  }

  if (tab === 'library') {
    return (
      <div className="nutrition-vnext-shell nutrition-vnext-shell--library">
        <header className="nutrition-vnext-topbar">
          <div>
            <small>FÉNIX</small>
            <h1>NUTRITION</h1>
          </div>
        </header>
        <nav className="nutrition-vnext-tabs" aria-label="Secciones de Nutrition">
          <button type="button" onClick={() => changeTab('today')}>Hoy</button>
          <button type="button" onClick={() => changeTab('week')}>Semana</button>
          <button type="button" className="active">Recetas · Compra</button>
        </nav>
        <NutritionLibrary embedded />
      </div>
    )
  }

  return (
    <main className="nutrition-vnext-shell">
      <header className="nutrition-vnext-topbar">
        <div>
          <small>FÉNIX</small>
          <h1>NUTRITION</h1>
        </div>
        <button className="nutrition-vnext-goalButton" type="button" onClick={() => setShowGoal(true)}>
          Objetivos
        </button>
      </header>

      <nav className="nutrition-vnext-tabs" aria-label="Secciones de Nutrition">
        <button type="button" className={tab === 'today' ? 'active' : ''} onClick={() => changeTab('today')}>Hoy</button>
        <button type="button" className={tab === 'week' ? 'active' : ''} onClick={() => changeTab('week')}>Semana</button>
        <button type="button" onClick={() => changeTab('library')}>Recetas · Compra</button>
      </nav>

      {error && <div className="nutrition-vnext-error">{error}</div>}
      {message && <div className="nutrition-vnext-message">{message}</div>}

      {loading && <div className="nutrition-vnext-loading">Preparando Nutrition…</div>}

      {!loading && tab === 'today' && day && (
        <>
          <section className="nutrition-vnext-dayHeader">
            <button type="button" onClick={() => { setLoading(true); setDate(shiftDate(date, -1)) }}>‹</button>
            <div>
              <small>
                {day.trainingSessions.length > 0
                  ? `${day.trainingSessions.map((session) => session.templateName).join(' + ')} · Training`
                  : 'Día sin Training'}
              </small>
              <h2>{formatDate(date)}</h2>
            </div>
            <button type="button" onClick={() => { setLoading(true); setDate(shiftDate(date, 1)) }}>›</button>
          </section>

          <MacroOverview consumed={day.consumed} planned={day.planned} target={day.goal} />

          <section className="nutrition-vnext-appetite">
            <div>
              <small>APETITO / VOLUMEN</small>
              <strong>¿Cómo quieres comer hoy?</strong>
            </div>
            <div className="nutrition-vnext-appetite__options">
              {appetiteOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={day.day.appetiteMode === option.value ? 'active' : ''}
                  onClick={() => void refreshDay(
                    () => setNutritionDayAppetite(day.date, option.value),
                    `Modo ${option.label.toLowerCase()} activo.`,
                  )}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </section>

          {nextPending && (
            <section className="nutrition-vnext-nextMeal nutrition-vnext-nextMeal--visual">
              <RecipeVisual
                recipe={nextPending.recipe}
                role={nextPending.meal.role}
                name={nextPending.meal.name}
                variant="hero"
              />
              <div className="nutrition-vnext-nextMeal__copy">
                <small>TE TOCA AHORA</small>
                <strong>{nutritionRoleLabel(nextPending.meal.role)}</strong>
                <span>{nextPending.meal.name}</span>
              </div>
              <span className="nutrition-vnext-nextMeal__energy">
                {nextPending.meal.plannedCalories === null ? '—' : `${number(nextPending.meal.plannedCalories)} kcal`}
              </span>
            </section>
          )}

          <section className="nutrition-vnext-dayPlan">
            <div className="nutrition-vnext-sectionHead">
              <div>
                <small>PLAN DEL DÍA</small>
                <h2>Comidas</h2>
              </div>
              <button type="button" onClick={() => setShowImprovised(true)}>+ Improvisada</button>
            </div>

            <div className="nutrition-vnext-mealList">
              {day.meals.map((item) => (
                <MealCard
                  key={item.meal.id}
                  item={item}
                  trainingSessionName={
                    item.meal.trainingSessionId
                      ? day.trainingSessions.find((session) => session.id === item.meal.trainingSessionId)?.templateName ?? null
                      : null
                  }
                  onComplete={() => refreshDay(() => setDailyMealStatus(item.meal.id, 'completed'))}
                  onSkip={() => refreshDay(() => setDailyMealStatus(item.meal.id, 'skipped'))}
                  onUndo={() => refreshDay(() => setDailyMealStatus(item.meal.id, 'pending'))}
                  onReplace={(recipeId) => refreshDay(() => replaceDailyMealRecipe(item.meal.id, recipeId))}
                  onPortion={(portion) => refreshDay(() => setDailyMealPortion(item.meal.id, portion))}
                />
              ))}
            </div>
          </section>

          <section className="nutrition-vnext-shortcuts">
            <button type="button" onClick={() => changeTab('week')}>
              <span>SEMANA</span>
              <strong>Planificar próximos días</strong>
              <em>→</em>
            </button>
            <button type="button" onClick={() => changeTab('library')}>
              <span>BIBLIOTECA</span>
              <strong>Recetas y compra</strong>
              <em>→</em>
            </button>
          </section>
        </>
      )}

      {!loading && tab === 'week' && week && (
        <WeekView
          week={week}
          preferredDate={date}
          onPrevious={() => { setLoading(true); setWeekAnchor(shiftDate(week.monday, -7)) }}
          onNext={() => { setLoading(true); setWeekAnchor(shiftDate(week.monday, 7)) }}
          onApply={async () => {
            try {
              const next = await applyNutritionWeek(week.monday)
              setWeek(next)
              setMessage('Semana aplicada. Se han reemplazado solo comidas pendientes.')
            } catch (applyError) {
              setError(applyError instanceof Error ? applyError.message : 'No se ha podido aplicar la semana.')
            }
          }}
        />
      )}

      {showImprovised && day && (
        <ImprovisedMealModal
          onClose={() => setShowImprovised(false)}
          onSave={(input) => refreshDay(() => addImprovisedMeal(day.date, input))}
        />
      )}

      {showGoal && (
        <GoalEditor
          current={day?.goal ?? week?.goal ?? null}
          onClose={() => setShowGoal(false)}
          onSave={async (input) => {
            await updateNutritionGoal(input)
            if (tab === 'today') {
              setDay(await getNutritionDay(date))
            } else if (tab === 'week') {
              setWeek(await getNutritionWeekSuggestion(weekAnchor))
            }
          }}
        />
      )}
    </main>
  )
}
