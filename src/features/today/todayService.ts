import {
  db,
} from '../../db/database'

import { parseDateKey } from '../../utils/date'
import { createUuid } from '../../utils/uuid'
export { getLocalDateKey } from '../../utils/date'

import {
  publishCommittedMutation,
} from '../../app/freshnessEvents'

import type {
  BaseEntity,
} from '../../types/common'

import type {
  DailyRoutine,
  DailyRoutineTask,
  DailyRoutineTemplate,
  DailyRoutineTemplateItem,
  TodayApplicability,
  TodayBlock,
  TodayTaskStatus,
  WorkShift,
} from '../../types/today'

export interface DailyRoutineContext {
  isTrainingDay: boolean

  isWorkDay: boolean
}

export interface DailyRoutineView {
  routine: DailyRoutine

  tasks: DailyRoutineTask[]

  workShift: WorkShift | null
}

export interface AddOneOffTaskInput {
  block: TodayBlock

  title: string

  description?: string | null
}

export interface UpdateDailyTaskInput {
  block?: TodayBlock

  order?: number

  title?: string

  description?: string | null
}

export interface WorkShiftInput {
  isWorking: boolean

  startTime?: string | null

  endTime?: string | null

  notes?: string | null
}

const BLOCK_ORDER: Record<
  TodayBlock,
  number
> = {
  morning: 10,
  postworkout: 20,
  development: 30,
  work: 40,
  night: 50,
}

function nowIso() {
  return new Date().toISOString()
}

function createBase(
  id: string = createUuid(),
): BaseEntity {
  const now = nowIso()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function getWeekday(
  dateKey: string,
) {
  return parseDateKey(
    dateKey,
  ).getDay()
}

function sortTasks(
  tasks: DailyRoutineTask[],
) {
  return [...tasks].sort(
    (first, second) => {
      const blockDifference =
        BLOCK_ORDER[first.block] -
        BLOCK_ORDER[second.block]

      if (blockDifference !== 0) {
        return blockDifference
      }

      return (
        first.order -
        second.order
      )
    },
  )
}

function isApplicable(
  applicability:
    TodayApplicability,

  context:
    DailyRoutineContext,
) {
  switch (applicability) {
    case 'always':
      return true

    case 'training_day':
      return context.isTrainingDay

    case 'non_training_day':
      return !context.isTrainingDay

    case 'work_day':
      return context.isWorkDay

    case 'non_work_day':
      return !context.isWorkDay

    case 'manual':
      return true
  }
}

function isTimingApplicable(
  item:
    DailyRoutineTemplateItem,

  dateKey: string,
) {
  const hasTimingRule =
    item.targetTime !== null ||
    item.latestTime !== null

  if (!hasTimingRule) {
    return false
  }

  if (
    item.timingDays === null
  ) {
    return true
  }

  return item.timingDays.includes(
    getWeekday(dateKey),
  )
}

function createDailyTask(
  routine:
    DailyRoutine,

  item:
    DailyRoutineTemplateItem,

  context:
    DailyRoutineContext,
): DailyRoutineTask {
  const applicable =
    isApplicable(
      item.applicability,
      context,
    )

  return {
    ...createBase(),

    dailyRoutineId:
      routine.id,

    date:
      routine.date,

    sourceTemplateItemId:
      item.id,

    block:
      item.block,

    order:
      item.order,

    kind: 'routine',

    title:
      item.title,

    description:
      item.description,

    applicability:
      item.applicability,

    status:
      applicable
        ? 'pending'
        : 'not_applicable',

    completedAt: null,

    statusChangedAt: null,

    targetTime:
      item.targetTime,

    latestTime:
      item.latestTime,

    timingApplies:
      isTimingApplicable(
        item,
        routine.date,
      ),
  }
}

async function getActiveTemplate():
  Promise<
    DailyRoutineTemplate | null
  > {
  const templates =
    await db
      .dailyRoutineTemplates
      .toArray()

  return (
    templates.find(
      (template) =>
        template.deletedAt === null &&
        template.isActive,
    ) ?? null
  )
}

async function getActiveTemplateItems(
  templateId: string,
) {
  const items =
    await db
      .dailyRoutineTemplateItems
      .where('templateId')
      .equals(templateId)
      .toArray()

  return items
    .filter(
      (item) =>
        item.deletedAt === null,
    )
    .sort(
      (first, second) => {
        const blockDifference =
          BLOCK_ORDER[first.block] -
          BLOCK_ORDER[second.block]

        if (
          blockDifference !== 0
        ) {
          return blockDifference
        }

        return (
          first.order -
          second.order
        )
      },
    )
}

class StaleRoutineReconciliationError extends Error {}

type PersistenceGuard = () => boolean

function assertPersistenceCurrent(canPersist: PersistenceGuard) {
  if (!canPersist()) {
    throw new StaleRoutineReconciliationError()
  }
}

async function reconcileRoutineContext(
  routine:
    DailyRoutine,

  context:
    DailyRoutineContext,

  canPersist: PersistenceGuard,
) {
  const tasks =
    await db
      .dailyRoutineTasks
      .where('dailyRoutineId')
      .equals(routine.id)
      .toArray()

  assertPersistenceCurrent(canPersist)

  const changedTasks:
    DailyRoutineTask[] = []

  const now = nowIso()

  for (const task of tasks) {
    if (
      task.deletedAt !== null
    ) {
      continue
    }

    const shouldApply =
      isApplicable(
        task.applicability,
        context,
      )

    if (
      task.status ===
        'not_applicable' &&
      shouldApply
    ) {
      changedTasks.push({
        ...task,

        status: 'pending',

        statusChangedAt:
          now,

        updatedAt:
          now,

        version:
          task.version + 1,
      })

      continue
    }

    if (
      task.status === 'pending' &&
      !shouldApply
    ) {
      changedTasks.push({
        ...task,

        status:
          'not_applicable',

        statusChangedAt:
          now,

        updatedAt:
          now,

        version:
          task.version + 1,
      })
    }
  }

  if (
    changedTasks.length > 0
  ) {
    assertPersistenceCurrent(canPersist)

    await db
      .dailyRoutineTasks
      .bulkPut(changedTasks)

    // The request can become stale while the final write is in flight.
    // Throwing here is still inside the Dexie transaction callback, so the
    // stale reconciliation is rolled back instead of being allowed to commit.
    assertPersistenceCurrent(canPersist)
  }
}

export async function getDailyRoutineView(
  dateKey: string,
): Promise<
  DailyRoutineView | null
> {
  parseDateKey(dateKey)

  const routine =
    await db
      .dailyRoutines
      .where('date')
      .equals(dateKey)
      .first()

  if (
    !routine ||
    routine.deletedAt !== null
  ) {
    return null
  }

  const tasks =
    await db
      .dailyRoutineTasks
      .where('dailyRoutineId')
      .equals(routine.id)
      .toArray()

  const workShift =
    await db
      .workShifts
      .where('date')
      .equals(dateKey)
      .first()

  return {
    routine,

    tasks:
      sortTasks(
        tasks.filter(
          (task) =>
            task.deletedAt ===
            null,
        ),
      ),

    workShift:
      workShift &&
      workShift.deletedAt === null
        ? workShift
        : null,
  }
}

async function materializeDailyRoutine(
  dateKey: string,

  context: DailyRoutineContext,

  canPersist: PersistenceGuard,
): Promise<boolean> {
  parseDateKey(dateKey)

  try {
    await db.transaction(
      'rw',

      db.dailyRoutineTemplates,
      db.dailyRoutineTemplateItems,
      db.dailyRoutines,
      db.dailyRoutineTasks,
      db.workShifts,

      async () => {
        const existingRoutine =
          await db
            .dailyRoutines
            .where('date')
            .equals(dateKey)
            .first()

        assertPersistenceCurrent(canPersist)

        if (
          existingRoutine &&
          existingRoutine.deletedAt ===
            null
        ) {
          await reconcileRoutineContext(
            existingRoutine,
            context,
            canPersist,
          )

          // Final causal boundary for the existing-routine transaction path.
          // No asynchronous operation may occur after this guard.
          assertPersistenceCurrent(canPersist)
          return
        }

        const template =
          await getActiveTemplate()

        if (!template) {
          throw new Error(
            'No existe una plantilla activa de Hoy.',
          )
        }

        const templateItems =
          await getActiveTemplateItems(
            template.id,
          )

        assertPersistenceCurrent(canPersist)

        const routine:
          DailyRoutine = {
          ...createBase(),

          date:
            dateKey,

          templateId:
            template.id,

          startedAt: null,
        }

        const tasks =
          templateItems.map(
            (item) =>
              createDailyTask(
                routine,
                item,
                context,
              ),
          )

        assertPersistenceCurrent(canPersist)

        await db
          .dailyRoutines
          .add(routine)

        // Covers the path where adding the routine is the final persistent
        // operation (no tasks) and the interval before a following bulkAdd.
        assertPersistenceCurrent(canPersist)

        if (tasks.length > 0) {
          await db
            .dailyRoutineTasks
            .bulkAdd(tasks)

          // If this request became stale while bulkAdd was in flight, abort the
          // transaction so both the routine and its tasks are rolled back.
          assertPersistenceCurrent(canPersist)
        }

        // Last synchronous causal check before the transaction callback exits.
        // Do not add an await after this assertion.
        assertPersistenceCurrent(canPersist)
      },
    )
  } catch (error) {
    if (error instanceof StaleRoutineReconciliationError) {
      return false
    }

    throw error
  }

  return true
}

export async function reconcileDailyRoutineForLoad(
  dateKey: string,

  context: DailyRoutineContext,

  canPersist: PersistenceGuard,
) {
  return materializeDailyRoutine(
    dateKey,
    context,
    canPersist,
  )
}

export async function ensureDailyRoutine(
  dateKey: string,

  context:
    DailyRoutineContext,
): Promise<DailyRoutineView> {
  await materializeDailyRoutine(
    dateKey,
    context,
    () => true,
  )

  const view =
    await getDailyRoutineView(
      dateKey,
    )

  if (!view) {
    throw new Error(
      'No se ha podido crear el día.',
    )
  }

  return view
}

export async function startDay(
  dateKey: string,
  context: DailyRoutineContext,
) {
  const view = await ensureDailyRoutine(dateKey, context)
  let changed = false

  await db.transaction('rw', db.dailyRoutines, async () => {
    const current = await db.dailyRoutines.get(view.routine.id)

    if (!current || current.deletedAt !== null) {
      throw new Error('No se ha podido localizar el día vigente.')
    }

    if (current.startedAt !== null) return

    const now = nowIso()
    await db.dailyRoutines.update(current.id, {
      startedAt: now,
      updatedAt: now,
      version: current.version + 1,
    })
    changed = true
  })

  if (changed) publishCommittedMutation('today')

  const updated = await getDailyRoutineView(dateKey)
  if (!updated) throw new Error('No se ha podido iniciar el día.')
  return updated
}

export async function setDailyTaskStatus(
  taskId: string,
  status: TodayTaskStatus,
) {
  await db.transaction('rw', db.dailyRoutineTasks, async () => {
    const task = await db.dailyRoutineTasks.get(taskId)
    if (!task || task.deletedAt !== null) throw new Error('La tarea indicada no existe.')

    const now = nowIso()
    await db.dailyRoutineTasks.update(task.id, {
      status,
      completedAt: status === 'completed' ? now : null,
      statusChangedAt: now,
      updatedAt: now,
      version: task.version + 1,
    })
  })

  publishCommittedMutation('today')
}

export async function updateDailyTask(
  taskId: string,
  input: UpdateDailyTaskInput,
) {
  await db.transaction('rw', db.dailyRoutineTasks, async () => {
    const task = await db.dailyRoutineTasks.get(taskId)
    if (!task || task.deletedAt !== null) throw new Error('La tarea indicada no existe.')

    const title = input.title === undefined ? task.title : input.title.trim()
    if (title.length === 0) throw new Error('La tarea necesita un nombre.')

    const now = nowIso()
    await db.dailyRoutineTasks.update(task.id, {
      title,
      description: input.description === undefined ? task.description : input.description,
      block: input.block ?? task.block,
      order: input.order ?? task.order,
      updatedAt: now,
      version: task.version + 1,
    })
  })

  publishCommittedMutation('today')
}

export async function addOneOffTask(
  dateKey: string,
  input: AddOneOffTaskInput,
  context: DailyRoutineContext,
) {
  const view = await ensureDailyRoutine(dateKey, context)
  const title = input.title.trim()
  if (title.length === 0) throw new Error('La tarea necesita un nombre.')

  let created: DailyRoutineTask | null = null

  await db.transaction('rw', db.dailyRoutines, db.dailyRoutineTasks, async () => {
    const routine = await db.dailyRoutines.get(view.routine.id)
    if (!routine || routine.deletedAt !== null || routine.date !== dateKey) {
      throw new Error('El día ya no está disponible.')
    }

    const currentTasks = await db.dailyRoutineTasks
      .where('dailyRoutineId')
      .equals(routine.id)
      .toArray()
    const tasksInBlock = currentTasks.filter(
      (task) => task.deletedAt === null && task.block === input.block,
    )
    const nextOrder = tasksInBlock.length === 0
      ? 10
      : Math.max(...tasksInBlock.map((task) => task.order)) + 10

    created = {
      ...createBase(),
      dailyRoutineId: routine.id,
      date: dateKey,
      sourceTemplateItemId: null,
      block: input.block,
      order: nextOrder,
      kind: 'one_off',
      title,
      description: input.description ?? null,
      applicability: 'manual',
      status: 'pending',
      completedAt: null,
      statusChangedAt: null,
      targetTime: null,
      latestTime: null,
      timingApplies: false,
    }

    await db.dailyRoutineTasks.add(created)
  })

  publishCommittedMutation('today')
  if (!created) throw new Error('No se ha podido crear la tarea.')
  return created
}

export async function deleteOneOffTask(taskId: string) {
  await db.transaction('rw', db.dailyRoutineTasks, async () => {
    const task = await db.dailyRoutineTasks.get(taskId)
    if (!task || task.deletedAt !== null) throw new Error('La tarea indicada no existe.')
    if (task.kind !== 'one_off') {
      throw new Error('Solo las tareas creadas para este día pueden eliminarse directamente.')
    }

    const now = nowIso()
    await db.dailyRoutineTasks.update(task.id, {
      deletedAt: now,
      updatedAt: now,
      version: task.version + 1,
    })
  })

  publishCommittedMutation('today')
}

export async function upsertWorkShift(
  dateKey: string,
  input: WorkShiftInput,
) {
  parseDateKey(dateKey)

  await db.transaction('rw', db.workShifts, async () => {
    const activeForDate = (await db.workShifts.where('date').equals(dateKey).toArray())
      .filter((item) => item.deletedAt === null)

    if (activeForDate.length > 1) {
      throw new Error('Integridad WorkShift: existe más de una jornada activa para esta fecha.')
    }

    const existing = activeForDate[0]
    const now = nowIso()

    if (existing) {
      const nextStatus: TodayTaskStatus = input.isWorking
        ? existing.status === 'not_applicable' ? 'pending' : existing.status
        : 'not_applicable'

      await db.workShifts.update(existing.id, {
        isWorking: input.isWorking,
        startTime: input.isWorking ? input.startTime ?? null : null,
        endTime: input.isWorking ? input.endTime ?? null : null,
        status: nextStatus,
        statusChangedAt: nextStatus !== existing.status ? now : existing.statusChangedAt,
        notes: input.notes === undefined ? existing.notes : input.notes,
        deletedAt: null,
        updatedAt: now,
        version: existing.version + 1,
      })
      return
    }

    const shift: WorkShift = {
      ...createBase(),
      date: dateKey,
      isWorking: input.isWorking,
      startTime: input.isWorking ? input.startTime ?? null : null,
      endTime: input.isWorking ? input.endTime ?? null : null,
      status: input.isWorking ? 'pending' : 'not_applicable',
      statusChangedAt: null,
      notes: input.notes ?? null,
    }
    await db.workShifts.add(shift)
  })

  publishCommittedMutation('today')
}

export async function setWorkShiftStatus(
  dateKey: string,
  status: 'pending' | 'completed' | 'skipped',
) {
  parseDateKey(dateKey)

  await db.transaction('rw', db.workShifts, async () => {
    const activeForDate = (await db.workShifts.where('date').equals(dateKey).toArray())
      .filter((item) => item.deletedAt === null)
    if (activeForDate.length !== 1) {
      throw new Error(activeForDate.length === 0
        ? 'No existe jornada laboral para esa fecha.'
        : 'Integridad WorkShift: existe más de una jornada activa para esta fecha.')
    }

    const shift = activeForDate[0]
    if (!shift.isWorking) throw new Error('Un día libre no puede tener estado de jornada laboral.')

    const now = nowIso()
    await db.workShifts.update(shift.id, {
      status,
      statusChangedAt: now,
      updatedAt: now,
      version: shift.version + 1,
    })
  })

  publishCommittedMutation('today')
}

export interface RoutineTemplateEditorView {
  template: DailyRoutineTemplate
  items: DailyRoutineTemplateItem[]
}

export interface RoutineTemplateItemInput {
  id?: string
  block: TodayBlock
  order: number
  title: string
  description: string | null
  applicability: TodayApplicability
  targetTime: string | null
  latestTime: string | null
  timingDays: number[] | null
}

export interface SaveRoutineTemplateOptions {
  applyToDate?: string | null
  context?: DailyRoutineContext | null
  settings?: {
    wakeTime: string
    defaultDayType: 'work' | 'free'
  } | null
}

export async function getRoutineTemplateEditorView(): Promise<RoutineTemplateEditorView> {
  const template = await getActiveTemplate()

  if (!template) {
    throw new Error('No existe una plantilla activa de Hoy.')
  }

  const items = await getActiveTemplateItems(template.id)

  return {
    template,
    items,
  }
}

function validateRoutineTemplateItemInput(input: RoutineTemplateItemInput) {
  if (!input.title.trim()) {
    throw new Error('Todos los pasos de la rutina necesitan un nombre.')
  }

  if (input.order < 0 || !Number.isFinite(input.order)) {
    throw new Error('El orden de la rutina no es válido.')
  }
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

async function applyTemplateSnapshotToDate(
  dateKey: string,
  context: DailyRoutineContext,
  activeItems: DailyRoutineTemplateItem[],
  archivedItemIds: Set<string>,
) {
  const routine = await db.dailyRoutines.where('date').equals(dateKey).first()

  if (!routine || routine.deletedAt !== null) {
    return
  }

  const currentTasks = await db.dailyRoutineTasks
    .where('dailyRoutineId')
    .equals(routine.id)
    .toArray()

  const taskBySource = new Map(
    currentTasks
      .filter((task) => task.deletedAt === null && task.sourceTemplateItemId)
      .map((task) => [task.sourceTemplateItemId as string, task]),
  )

  const now = nowIso()
  const changes: DailyRoutineTask[] = []
  const additions: DailyRoutineTask[] = []

  for (const item of activeItems) {
    const existing = taskBySource.get(item.id)

    if (!existing) {
      additions.push(createDailyTask(routine, item, context))
      continue
    }

    if (existing.status === 'completed' || existing.status === 'skipped') {
      continue
    }

    const nextApplicable = isApplicable(item.applicability, context)
    const nextStatus: TodayTaskStatus = nextApplicable ? 'pending' : 'not_applicable'

    changes.push({
      ...existing,
      block: item.block,
      order: item.order,
      title: item.title,
      description: item.description,
      applicability: item.applicability,
      targetTime: item.targetTime,
      latestTime: item.latestTime,
      timingApplies: isTimingApplicable(item, dateKey),
      status: nextStatus,
      statusChangedAt:
        nextStatus !== existing.status ? now : existing.statusChangedAt,
      updatedAt: now,
      version: existing.version + 1,
    })
  }

  for (const task of currentTasks) {
    if (
      task.deletedAt !== null ||
      !task.sourceTemplateItemId ||
      !archivedItemIds.has(task.sourceTemplateItemId)
    ) {
      continue
    }

    /*
     * Al aplicar una nueva plantilla al día actual solo retiramos pasos
     * que todavía no representan una acción histórica confirmada.
     * Completadas/omitidas se conservan para no reescribir lo ocurrido.
     */
    if (task.status === 'pending' || task.status === 'not_applicable') {
      changes.push({
        ...task,
        deletedAt: now,
        updatedAt: now,
        version: task.version + 1,
      })
    }
  }

  if (changes.length > 0) {
    await db.dailyRoutineTasks.bulkPut(changes)
  }

  if (additions.length > 0) {
    await db.dailyRoutineTasks.bulkAdd(additions)
  }
}

export async function saveRoutineTemplate(
  inputs: RoutineTemplateItemInput[],
  options: SaveRoutineTemplateOptions = {},
): Promise<RoutineTemplateEditorView> {
  for (const input of inputs) validateRoutineTemplateItemInput(input)

  await db.transaction(
    'rw',
    db.dailyRoutineTemplates,
    db.dailyRoutineTemplateItems,
    db.dailyRoutines,
    db.dailyRoutineTasks,
    db.appMeta,
    async () => {
      const activeTemplates = (await db.dailyRoutineTemplates.toArray())
        .filter((item) => item.deletedAt === null && item.isActive)

      if (activeTemplates.length !== 1) {
        throw new Error(activeTemplates.length === 0
          ? 'No existe una plantilla activa de Hoy.'
          : 'Integridad Today: existe más de una plantilla activa.')
      }

      const template = activeTemplates[0]
      const existingItems = (await db.dailyRoutineTemplateItems
        .where('templateId')
        .equals(template.id)
        .toArray())
        .filter((item) => item.deletedAt === null)
      const existingById = new Map(existingItems.map((item) => [item.id, item]))
      const incomingIds = new Set(inputs.flatMap((input) => input.id ? [input.id] : []))
      const now = nowIso()

      const savedItems: DailyRoutineTemplateItem[] = inputs.map((input) => {
        const existing = input.id ? existingById.get(input.id) : undefined
        if (input.id && !existing) {
          throw new Error('La rutina ha cambiado. Recarga Ajustes antes de volver a guardar.')
        }
        if (existing) {
          return {
            ...existing,
            block: input.block,
            order: input.order,
            title: input.title.trim(),
            description: normalizeOptionalText(input.description),
            applicability: input.applicability,
            targetTime: normalizeOptionalText(input.targetTime),
            latestTime: normalizeOptionalText(input.latestTime),
            timingDays: input.timingDays,
            deletedAt: null,
            updatedAt: now,
            version: existing.version + 1,
          }
        }
        return {
          ...createBase(input.id ?? createUuid()),
          templateId: template.id,
          block: input.block,
          order: input.order,
          title: input.title.trim(),
          description: normalizeOptionalText(input.description),
          applicability: input.applicability,
          targetTime: normalizeOptionalText(input.targetTime),
          latestTime: normalizeOptionalText(input.latestTime),
          timingDays: input.timingDays,
        }
      })

      const archivedItems = existingItems
        .filter((item) => !incomingIds.has(item.id))
        .map((item) => ({
          ...item,
          deletedAt: now,
          updatedAt: now,
          version: item.version + 1,
        }))
      const archivedItemIds = new Set(archivedItems.map((item) => item.id))

      if (savedItems.length > 0) await db.dailyRoutineTemplateItems.bulkPut(savedItems)
      if (archivedItems.length > 0) await db.dailyRoutineTemplateItems.bulkPut(archivedItems)
      await db.dailyRoutineTemplates.update(template.id, {
        updatedAt: now,
        version: template.version + 1,
      })

      if (options.settings) {
        await db.appMeta.bulkPut([
          { key: 'v21:routineWakeTime', value: options.settings.wakeTime, updatedAt: now },
          { key: 'v21:routineDefaultDayType', value: options.settings.defaultDayType, updatedAt: now },
        ])
      }

      if (options.applyToDate && options.context) {
        await applyTemplateSnapshotToDate(
          options.applyToDate,
          options.context,
          savedItems,
          archivedItemIds,
        )
      }
    },
  )

  publishCommittedMutation('today')
  return getRoutineTemplateEditorView()
}

export async function promoteOneOffTaskToRoutine(
  taskId: string,
): Promise<DailyRoutineTemplateItem> {
  let created: DailyRoutineTemplateItem | null = null

  await db.transaction(
    'rw',
    db.dailyRoutineTasks,
    db.dailyRoutineTemplates,
    db.dailyRoutineTemplateItems,
    async () => {
      const task = await db.dailyRoutineTasks.get(taskId)
      if (!task || task.deletedAt !== null) throw new Error('La tarea indicada no existe.')
      if (task.kind !== 'one_off') throw new Error('Esta tarea ya pertenece a la rutina.')

      const activeTemplates = (await db.dailyRoutineTemplates.toArray())
        .filter((item) => item.deletedAt === null && item.isActive)
      if (activeTemplates.length !== 1) {
        throw new Error(activeTemplates.length === 0
          ? 'No existe una plantilla activa de Hoy.'
          : 'Integridad Today: existe más de una plantilla activa.')
      }
      const template = activeTemplates[0]
      const items = (await db.dailyRoutineTemplateItems.where('templateId').equals(template.id).toArray())
        .filter((item) => item.deletedAt === null)
      const sameBlock = items.filter((item) => item.block === task.block)
      const nextOrder = sameBlock.length === 0 ? 10 : Math.max(...sameBlock.map((item) => item.order)) + 10
      const now = nowIso()
      const item: DailyRoutineTemplateItem = {
        ...createBase(),
        templateId: template.id,
        block: task.block,
        order: nextOrder,
        title: task.title,
        description: task.description,
        applicability: task.block === 'work'
          ? 'work_day'
          : task.block === 'postworkout' ? 'training_day' : 'always',
        targetTime: task.targetTime,
        latestTime: task.latestTime,
        timingDays: null,
      }
      await db.dailyRoutineTemplateItems.add(item)
      await db.dailyRoutineTemplates.update(template.id, {
        updatedAt: now,
        version: template.version + 1,
      })
      created = item
    },
  )

  publishCommittedMutation('today')
  if (!created) throw new Error('No se ha podido añadir el paso a la rutina.')
  return created
}
