import { useRef, useState } from 'react'
import type { Exercise } from '../../types/training'
import type { TrainingTemplateView } from './trainingService'
import { getLocalDateKey } from './trainingService'
import { saveRoutineDefinition, saveCustomExercise, planWorkout, isCustomExercise, type RoutineDraft, type RoutineItemDraft, type ExerciseDraft } from './trainingEditorService'
import './training-editors.css'

function useSaveAction() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await action() }
    catch (value) { setError(value instanceof Error ? value.message : 'No se pudo guardar.') }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, run }
}

function RoutineForm({ view, catalog, onClose, onSaved }: {
  view: TrainingTemplateView | null; catalog: Exercise[]; onClose: () => void; onSaved: () => Promise<void>
}) {
  const [id] = useState(() => view?.template.id ?? crypto.randomUUID())
  const [draft, setDraft] = useState<RoutineDraft>(() => ({
    name: view?.template.name ?? '', type: view?.template.type ?? 'upper',
    description: view?.template.description ?? '',
    estimatedDurationMinutes: view?.template.estimatedDurationMinutes ?? null,
    isFormalStrength: view?.template.isFormalStrength ?? true,
  }))
  const [items, setItems] = useState<RoutineItemDraft[]>(() => view?.exercises.map(({ config }) => ({
    id: config.id, version: config.version, exerciseId: config.exerciseId,
    targetSets: config.targetSets, minReps: config.minReps, maxReps: config.maxReps,
    targetRirMin: config.targetRirMin ?? config.targetRir,
    targetRirMax: config.targetRirMax ?? config.targetRir, restSeconds: config.restSeconds,
  })) ?? [])
  const [selected, setSelected] = useState(catalog[0]?.id ?? '')
  const save = useSaveAction()
  function patch(index: number, value: Partial<RoutineItemDraft>) {
    setItems(current => current.map((item, i) => i === index ? { ...item, ...value } : item))
  }
  function move(index: number, delta: number) {
    setItems(current => {
      const next = [...current]
      const other = index + delta
      if (other < 0 || other >= next.length) return current
      ;[next[index], next[other]] = [next[other], next[index]]
      return next
    })
  }
  return <form className="training-definition-editor" onSubmit={event => {
    event.preventDefault()
    void save.run(async () => {
      await saveRoutineDefinition(id, view?.template.version ?? null, draft, items, view?.exercises.map(({ config }) => ({ id: config.id, version: config.version })) ?? [])
      onClose()
      await onSaved()
    })
  }}>
    <h2>{view ? 'Editar rutina' : 'Crear rutina'}</h2>
    <p>Los cambios se aplican a futuras ejecuciones. El historial y la sesión activa conservan sus datos.</p>
    <fieldset disabled={save.busy}>
      <label>Nombre<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Tipo<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as RoutineDraft['type'] })}>
        <option value="upper">Tren superior</option><option value="lower">Tren inferior</option><option value="core">Core</option><option value="mobility">Movilidad</option><option value="recovery">Recuperación</option>
      </select></label>
      <label>Descripción<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>Duración estimada (min)<input type="number" min="1" max="1440" value={draft.estimatedDurationMinutes ?? ''} onChange={event => setDraft({ ...draft, estimatedDurationMinutes: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={draft.isFormalStrength} onChange={event => setDraft({ ...draft, isFormalStrength: event.target.checked })} /> Sesión formal de fuerza</label>
      {items.map((item, index) => <section className="training-definition-row" key={item.id}>
        <strong>{index + 1}. {catalog.find(exercise => exercise.id === item.exerciseId)?.name ?? 'Ejercicio no disponible'}</strong>
        <div className="training-definition-numbers">
          {(['targetSets', 'minReps', 'maxReps', 'targetRirMin', 'targetRirMax', 'restSeconds'] as const).map((field, fieldIndex) => <label key={field}>
            {['Series', 'Reps mín.', 'Reps máx.', 'RIR mín.', 'RIR máx.', 'Descanso (s)'][fieldIndex]}
            <input type="number" step={field.startsWith('targetRir') ? '0.5' : '1'} min={field === 'restSeconds' || field.startsWith('targetRir') ? '0' : '1'} required={!field.startsWith('targetRir')} value={item[field] ?? ''} onChange={event => patch(index, { [field]: event.target.value === '' && field.startsWith('targetRir') ? null : Number(event.target.value) })} />
          </label>)}
        </div>
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Subir</button>
        <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)}>Bajar</button>
        <button type="button" onClick={() => setItems(current => current.filter(row => row.id !== item.id))}>Quitar de rutina</button>
      </section>)}
      <label>Añadir ejercicio<select value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Selecciona un ejercicio</option>
        {catalog.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
      </select></label>
      <button type="button" disabled={!selected} onClick={() => setItems(current => [...current, {
        id: crypto.randomUUID(), version: null, exerciseId: selected, targetSets: 3, minReps: 8, maxReps: 12, targetRirMin: 2, targetRirMax: 3, restSeconds: 90,
      }])}>Añadir ejercicio</button>
      <button type="submit">Guardar rutina</button>
      <button type="button" onClick={onClose}>Cerrar editor</button>
    </fieldset>
    {save.error && <p role="alert">{save.error}</p>}
  </form>
}

function ExerciseForm({ exercise, onClose, onSaved }: { exercise: Exercise | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [id] = useState(() => exercise?.id ?? 'custom-exercise-' + crypto.randomUUID())
  const [draft, setDraft] = useState<ExerciseDraft>(() => ({
    name: exercise?.name ?? '', primaryMuscle: exercise?.primaryMuscle ?? '',
    equipment: exercise?.equipment ?? '', exerciseType: exercise?.exerciseType ?? 'compound',
    techniqueNotes: exercise?.techniqueNotes ?? '',
  }))
  const save = useSaveAction()
  return <form className="training-definition-editor" onSubmit={event => {
    event.preventDefault()
    void save.run(async () => { await saveCustomExercise(id, exercise?.version ?? null, draft); onClose(); await onSaved() })
  }}>
    <h2>{exercise ? 'Editar ejercicio propio' : 'Crear ejercicio propio'}</h2>
    <fieldset disabled={save.busy}>
      <label>Nombre<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Grupo muscular<input required value={draft.primaryMuscle} onChange={event => setDraft({ ...draft, primaryMuscle: event.target.value })} /></label>
      <label>Equipo<input required value={draft.equipment} onChange={event => setDraft({ ...draft, equipment: event.target.value })} /></label>
      <label>Tipo<select value={draft.exerciseType} onChange={event => setDraft({ ...draft, exerciseType: event.target.value as ExerciseDraft['exerciseType'] })}>
        <option value="compound">Compuesto</option><option value="isolation">Aislamiento</option><option value="core">Core</option><option value="mobility">Movilidad</option>
      </select></label>
      <label>Notas técnicas<textarea value={draft.techniqueNotes} onChange={event => setDraft({ ...draft, techniqueNotes: event.target.value })} /></label>
      <button type="submit">Guardar ejercicio</button><button type="button" onClick={onClose}>Cerrar editor</button>
    </fieldset>
    {save.error && <p role="alert">{save.error}</p>}
  </form>
}

function PlanningForm({ view, onClose, onSaved }: { view: TrainingTemplateView; onClose: () => void; onSaved: () => Promise<void> }) {
  const [id] = useState(() => crypto.randomUUID())
  const [date, setDate] = useState(getLocalDateKey())
  const save = useSaveAction()
  return <form className="training-definition-editor" onSubmit={event => {
    event.preventDefault()
    void save.run(async () => { await planWorkout(id, view.template.id, view.template.version, date); onClose(); await onSaved() })
  }}>
    <h2>Planificar {view.template.name}</h2><p>Crea una sesión independiente. Puedes planificar varias sesiones el mismo día.</p>
    <fieldset disabled={save.busy}>
      <label>Fecha<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <button type="submit">Confirmar planificación</button><button type="button" onClick={onClose}>Cancelar</button>
    </fieldset>
    {save.error && <p role="alert">{save.error}</p>}
  </form>
}

export function RoutineManager({ templates, catalog, onReload, onStart }: {
  templates: TrainingTemplateView[]; catalog: Exercise[]; onReload: () => Promise<void>; onStart: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<{ view: TrainingTemplateView | null } | null>(null)
  const [planning, setPlanning] = useState<TrainingTemplateView | null>(null)
  if (editing) return <RoutineForm view={editing.view} catalog={catalog} onClose={() => setEditing(null)} onSaved={onReload} />
  if (planning) return <PlanningForm view={planning} onClose={() => setPlanning(null)} onSaved={onReload} />
  return <div className="training-definition-list">
    <button type="button" onClick={() => setEditing({ view: null })}>Crear rutina</button>
    {templates.map(view => <section className="training-routine-card" key={view.template.id}>
      <details className="training-routine-detail">
        <summary><h2>{view.template.name}</h2><span>{view.template.type} · {view.exercises.length} ejercicios · {view.totalSets} series</span></summary>
        <p>{view.template.description}</p>
        <ol>{view.exercises.map(item => <li key={item.config.id}>{item.exercise.name}</li>)}</ol>
      </details>
      <div className="beta-routine-actions"><button type="button" onClick={() => setEditing({ view })}>Editar rutina</button>
      <button type="button" onClick={() => setPlanning(view)}>Planificar sesión</button>
      <button type="button" className="training-primary-button" onClick={() => void onStart(view.template.id)}>Iniciar ahora</button></div>
    </section>)}
  </div>
}

export function CustomExerciseManager({ exercises, onReload }: { exercises: Exercise[]; onReload: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ exercise: Exercise | null } | null>(null)
  if (editing) return <ExerciseForm exercise={editing.exercise} onClose={() => setEditing(null)} onSaved={onReload} />
  return <section className="training-definition-list">
    <button type="button" onClick={() => setEditing({ exercise: null })}>Crear ejercicio propio</button>
    {exercises.filter(isCustomExercise).map(exercise => <button type="button" key={exercise.id} onClick={() => setEditing({ exercise })}>Editar {exercise.name}</button>)}
  </section>
}
