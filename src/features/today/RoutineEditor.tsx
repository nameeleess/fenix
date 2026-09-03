import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  DailyRoutineContext,
  RoutineTemplateItemInput,
} from './todayService'

import {
  getRoutineTemplateEditorView,
  saveRoutineTemplate,
} from './todayService'

import type {
  TodayApplicability,
  TodayBlock,
} from '../../types/today'

const BLOCKS: Array<{ value: TodayBlock; label: string }> = [
  { value: 'morning', label: 'Mañana' },
  { value: 'postworkout', label: 'Post-entreno' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'work', label: 'Trabajo' },
  { value: 'night', label: 'Noche' },
]

const APPLICABILITY: Array<{ value: TodayApplicability; label: string }> = [
  { value: 'always', label: 'Siempre' },
  { value: 'training_day', label: 'Día de Training' },
  { value: 'non_training_day', label: 'Día sin Training' },
  { value: 'work_day', label: 'Día de trabajo' },
  { value: 'non_work_day', label: 'Día libre' },
  { value: 'manual', label: 'Manual' },
]

interface RoutineEditorProps {
  dateKey: string
  context: DailyRoutineContext
  onClose: () => void
  onSaved: () => Promise<void> | void
}

interface EditorItem extends RoutineTemplateItemInput {
  clientKey: string
}

function normalizedOrder(items: EditorItem[]) {
  const blockCounters = new Map<TodayBlock, number>()

  return items.map((item) => {
    const next = (blockCounters.get(item.block) ?? 0) + 10
    blockCounters.set(item.block, next)

    return {
      ...item,
      order: next,
    }
  })
}

function RoutineEditor({
  dateKey,
  context,
  onClose,
  onSaved,
}: RoutineEditorProps) {
  const [items, setItems] = useState<EditorItem[]>([])
  const [templateName, setTemplateName] = useState('Rutina diaria')
  const [applyToToday, setApplyToToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const timer = window.setTimeout(() => {
      void getRoutineTemplateEditorView()
        .then((view) => {
          if (!active) return

          setTemplateName(view.template.name)
          setItems(
            normalizedOrder(
              view.items.map((item) => ({
                id: item.id,
                clientKey: item.id,
                block: item.block,
                order: item.order,
                title: item.title,
                description: item.description,
                applicability: item.applicability,
                targetTime: item.targetTime,
                latestTime: item.latestTime,
                timingDays: item.timingDays,
              })),
            ),
          )
          setLoading(false)
        })
        .catch((loadError: unknown) => {
          if (!active) return
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se ha podido cargar la rutina.',
          )
          setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const grouped = useMemo(
    () =>
      BLOCKS.map((block) => ({
        ...block,
        items: items.filter((item) => item.block === block.value),
      })),
    [items],
  )

  function patchItem(clientKey: string, patch: Partial<EditorItem>) {
    setItems((current) =>
      normalizedOrder(
        current.map((item) =>
          item.clientKey === clientKey
            ? { ...item, ...patch }
            : item,
        ),
      ),
    )
  }

  function addItem(block: TodayBlock) {
    const clientKey = `new-${crypto.randomUUID()}`

    setItems((current) =>
      normalizedOrder([
        ...current,
        {
          clientKey,
          block,
          order: 10,
          title: 'Nuevo paso',
          description: null,
          applicability: 'always',
          targetTime: null,
          latestTime: null,
          timingDays: null,
        },
      ]),
    )
  }

  function removeItem(clientKey: string) {
    setItems((current) =>
      normalizedOrder(current.filter((item) => item.clientKey !== clientKey)),
    )
  }

  function moveItem(clientKey: string, direction: -1 | 1) {
    setItems((current) => {
      const item = current.find((candidate) => candidate.clientKey === clientKey)
      if (!item) return current

      const sameBlock = current.filter((candidate) => candidate.block === item.block)
      const localIndex = sameBlock.findIndex((candidate) => candidate.clientKey === clientKey)
      const swapIndex = localIndex + direction

      if (swapIndex < 0 || swapIndex >= sameBlock.length) return current

      const other = sameBlock[swapIndex]
      const positions = current.map((candidate) => candidate.clientKey)
      const firstIndex = positions.indexOf(item.clientKey)
      const secondIndex = positions.indexOf(other.clientKey)
      const next = [...current]
      ;[next[firstIndex], next[secondIndex]] = [next[secondIndex], next[firstIndex]]

      return normalizedOrder(next)
    })
  }

  async function save() {
    if (items.some((item) => !item.title.trim())) {
      setError('Todos los pasos necesitan un nombre.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await saveRoutineTemplate(
        normalizedOrder(items).map((item) => ({
          id: item.id,
          block: item.block,
          order: item.order,
          title: item.title,
          description: item.description,
          applicability: item.applicability,
          targetTime: item.targetTime,
          latestTime: item.latestTime,
          timingDays: item.timingDays,
        })),
        {
          applyToDate: applyToToday ? dateKey : null,
          context: applyToToday ? context : null,
        },
      )

      await onSaved()
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se ha podido guardar la rutina.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routine-editor" role="dialog" aria-modal="true" aria-label="Editar rutina diaria">
      <div className="routine-editor__sheet">
        <header className="routine-editor__header">
          <button type="button" className="routine-editor__back" onClick={onClose} aria-label="Cerrar editor">
            ‹
          </button>
          <div>
            <span>RUTINA BASE</span>
            <h2>Editar rutina diaria</h2>
            <p>{templateName} · los cambios afectan a días futuros.</p>
          </div>
        </header>

        {error && <div className="routine-editor__error" role="alert">{error}</div>}

        {loading ? (
          <div className="routine-editor__loading">Cargando rutina…</div>
        ) : (
          <div className="routine-editor__content">
            {grouped.map((group) => (
              <section key={group.value} className="routine-editor__block">
                <div className="routine-editor__blockHead">
                  <div>
                    <span>BLOQUE</span>
                    <h3>{group.label}</h3>
                  </div>
                  <button type="button" onClick={() => addItem(group.value)}>+ Paso</button>
                </div>

                {group.items.length === 0 ? (
                  <p className="routine-editor__empty">Sin pasos permanentes.</p>
                ) : (
                  <div className="routine-editor__list">
                    {group.items.map((item, index) => (
                      <article key={item.clientKey} className="routine-editor__item">
                        <div className="routine-editor__itemOrder">
                          <span>{index + 1}</span>
                          <div>
                            <button
                              type="button"
                              aria-label={`Subir ${item.title}`}
                              disabled={index === 0}
                              onClick={() => moveItem(item.clientKey, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label={`Bajar ${item.title}`}
                              disabled={index === group.items.length - 1}
                              onClick={() => moveItem(item.clientKey, 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </div>

                        <div className="routine-editor__fields">
                          <input
                            value={item.title}
                            aria-label="Nombre del paso"
                            onChange={(event) => patchItem(item.clientKey, { title: event.target.value })}
                          />

                          <input
                            value={item.description ?? ''}
                            placeholder="Descripción opcional"
                            aria-label="Descripción del paso"
                            onChange={(event) => patchItem(item.clientKey, { description: event.target.value || null })}
                          />

                          <div className="routine-editor__row">
                            <select
                              value={item.applicability}
                              aria-label="Cuándo aplica"
                              onChange={(event) =>
                                patchItem(item.clientKey, {
                                  applicability: event.target.value as TodayApplicability,
                                })
                              }
                            >
                              {APPLICABILITY.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>

                            <select
                              value={item.block}
                              aria-label="Bloque"
                              onChange={(event) =>
                                patchItem(item.clientKey, {
                                  block: event.target.value as TodayBlock,
                                })
                              }
                            >
                              {BLOCKS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="routine-editor__row routine-editor__row--time">
                            <label>
                              <span>Hora objetivo</span>
                              <input
                                type="time"
                                value={item.targetTime ?? ''}
                                onChange={(event) => patchItem(item.clientKey, { targetTime: event.target.value || null })}
                              />
                            </label>
                            <label>
                              <span>Límite</span>
                              <input
                                type="time"
                                value={item.latestTime ?? ''}
                                onChange={(event) => patchItem(item.clientKey, { latestTime: event.target.value || null })}
                              />
                            </label>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="routine-editor__remove"
                          onClick={() => removeItem(item.clientKey)}
                          aria-label={`Eliminar ${item.title}`}
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <footer className="routine-editor__footer">
          <label className="routine-editor__applyToday">
            <input
              type="checkbox"
              checked={applyToToday}
              onChange={(event) => setApplyToToday(event.target.checked)}
            />
            <span>
              <strong>Aplicar también a hoy</strong>
              <small>Solo actualiza pasos todavía pendientes; no borra lo ya completado u omitido.</small>
            </span>
          </label>

          <button
            type="button"
            className="routine-editor__save"
            disabled={loading || saving}
            onClick={() => void save()}
          >
            {saving ? 'Guardando…' : 'Guardar rutina'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default RoutineEditor
