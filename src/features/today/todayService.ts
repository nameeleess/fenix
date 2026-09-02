import {
  db,
} from '../../db/database'

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
  id = crypto.randomUUID(),
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

export function getLocalDateKey(
  date = new Date(),
) {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0')

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(
  dateKey: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateKey,
    )

  if (!match) {
    throw new Error(
      'La fecha debe tener formato YYYY-MM-DD.',
    )
  }

  const year =
    Number(match[1])

  const month =
    Number(match[2])

  const day =
    Number(match[3])

  const parsed =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0,
    )

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !==
      month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(
      'La fecha indicada no es válida.',
    )
  }

  return parsed
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

async function reconcileRoutineContext(
  routine:
    DailyRoutine,

  context:
    DailyRoutineContext,
) {
  const tasks =
    await db
      .dailyRoutineTasks
      .where('dailyRoutineId')
      .equals(routine.id)
      .toArray()

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
    await db
      .dailyRoutineTasks
      .bulkPut(changedTasks)
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

export async function ensureDailyRoutine(
  dateKey: string,

  context:
    DailyRoutineContext,
): Promise<DailyRoutineView> {
  parseDateKey(dateKey)

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

      if (
        existingRoutine &&
        existingRoutine.deletedAt ===
          null
      ) {
        await reconcileRoutineContext(
          existingRoutine,
          context,
        )

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

      await db
        .dailyRoutines
        .add(routine)

      if (tasks.length > 0) {
        await db
          .dailyRoutineTasks
          .bulkAdd(tasks)
      }
    },
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

  context:
    DailyRoutineContext,
) {
  const view =
    await ensureDailyRoutine(
      dateKey,
      context,
    )

  if (
    view.routine.startedAt !== null
  ) {
    return view
  }

  const now = nowIso()

  await db.dailyRoutines.update(
    view.routine.id,
    {
      startedAt: now,

      updatedAt: now,

      version:
        view.routine.version + 1,
    },
  )

  const updated =
    await getDailyRoutineView(
      dateKey,
    )

  if (!updated) {
    throw new Error(
      'No se ha podido iniciar el día.',
    )
  }

  return updated
}

export async function setDailyTaskStatus(
  taskId: string,

  status: TodayTaskStatus,
) {
  const task =
    await db
      .dailyRoutineTasks
      .get(taskId)

  if (
    !task ||
    task.deletedAt !== null
  ) {
    throw new Error(
      'La tarea indicada no existe.',
    )
  }

  const now = nowIso()

  await db
    .dailyRoutineTasks
    .update(
      task.id,
      {
        status,

        completedAt:
          status === 'completed'
            ? now
            : null,

        statusChangedAt:
          now,

        updatedAt:
          now,

        version:
          task.version + 1,
      },
    )
}

export async function updateDailyTask(
  taskId: string,

  input:
    UpdateDailyTaskInput,
) {
  const task =
    await db
      .dailyRoutineTasks
      .get(taskId)

  if (
    !task ||
    task.deletedAt !== null
  ) {
    throw new Error(
      'La tarea indicada no existe.',
    )
  }

  const title =
    input.title === undefined
      ? task.title
      : input.title.trim()

  if (title.length === 0) {
    throw new Error(
      'La tarea necesita un nombre.',
    )
  }

  const now = nowIso()

  await db
    .dailyRoutineTasks
    .update(
      task.id,
      {
        title,

        description:
          input.description ===
          undefined
            ? task.description
            : input.description,

        block:
          input.block ??
          task.block,

        order:
          input.order ??
          task.order,

        updatedAt:
          now,

        version:
          task.version + 1,
      },
    )
}

export async function addOneOffTask(
  dateKey: string,

  input:
    AddOneOffTaskInput,

  context:
    DailyRoutineContext,
) {
  const view =
    await ensureDailyRoutine(
      dateKey,
      context,
    )

  const title =
    input.title.trim()

  if (title.length === 0) {
    throw new Error(
      'La tarea necesita un nombre.',
    )
  }

  const tasksInBlock =
    view.tasks.filter(
      (task) =>
        task.block ===
        input.block,
    )

  const nextOrder =
    tasksInBlock.length === 0
      ? 10
      : Math.max(
          ...tasksInBlock.map(
            (task) =>
              task.order,
          ),
        ) + 10

  const task:
    DailyRoutineTask = {
    ...createBase(),

    dailyRoutineId:
      view.routine.id,

    date:
      dateKey,

    sourceTemplateItemId:
      null,

    block:
      input.block,

    order:
      nextOrder,

    kind: 'one_off',

    title,

    description:
      input.description ?? null,

    applicability: 'manual',

    status: 'pending',

    completedAt: null,

    statusChangedAt: null,

    targetTime: null,

    latestTime: null,

    timingApplies: false,
  }

  await db
    .dailyRoutineTasks
    .add(task)

  return task
}

export async function deleteOneOffTask(
  taskId: string,
) {
  const task =
    await db
      .dailyRoutineTasks
      .get(taskId)

  if (
    !task ||
    task.deletedAt !== null
  ) {
    throw new Error(
      'La tarea indicada no existe.',
    )
  }

  if (
    task.kind !== 'one_off'
  ) {
    throw new Error(
      'Solo las tareas creadas para este día pueden eliminarse directamente.',
    )
  }

  const now = nowIso()

  await db
    .dailyRoutineTasks
    .update(
      task.id,
      {
        deletedAt:
          now,

        updatedAt:
          now,

        version:
          task.version + 1,
      },
    )
}

export async function upsertWorkShift(
  dateKey: string,

  input:
    WorkShiftInput,
) {
  parseDateKey(dateKey)

  const existing =
    await db
      .workShifts
      .where('date')
      .equals(dateKey)
      .first()

  const now = nowIso()

  if (existing) {
    const nextStatus:
      TodayTaskStatus =
      input.isWorking
        ? existing.status ===
          'not_applicable'
          ? 'pending'
          : existing.status
        : 'not_applicable'

    await db.workShifts.update(
      existing.id,
      {
        isWorking:
          input.isWorking,

        startTime:
          input.isWorking
            ? input.startTime ??
              null
            : null,

        endTime:
          input.isWorking
            ? input.endTime ??
              null
            : null,

        status:
          nextStatus,

        statusChangedAt:
          nextStatus !==
          existing.status
            ? now
            : existing
                .statusChangedAt,

        notes:
          input.notes ===
          undefined
            ? existing.notes
            : input.notes,

        deletedAt: null,

        updatedAt:
          now,

        version:
          existing.version + 1,
      },
    )

    return
  }

  const shift:
    WorkShift = {
    ...createBase(),

    date:
      dateKey,

    isWorking:
      input.isWorking,

    startTime:
      input.isWorking
        ? input.startTime ??
          null
        : null,

    endTime:
      input.isWorking
        ? input.endTime ??
          null
        : null,

    status:
      input.isWorking
        ? 'pending'
        : 'not_applicable',

    statusChangedAt: null,

    notes:
      input.notes ?? null,
  }

  await db.workShifts.add(
    shift,
  )
}

export async function setWorkShiftStatus(
  dateKey: string,

  status:
    | 'pending'
    | 'completed'
    | 'skipped',
) {
  parseDateKey(dateKey)

  const shift =
    await db
      .workShifts
      .where('date')
      .equals(dateKey)
      .first()

  if (
    !shift ||
    shift.deletedAt !== null
  ) {
    throw new Error(
      'No existe jornada laboral para esa fecha.',
    )
  }

  if (!shift.isWorking) {
    throw new Error(
      'Un día libre no puede tener estado de jornada laboral.',
    )
  }

  const now = nowIso()

  await db.workShifts.update(
    shift.id,
    {
      status,

      statusChangedAt:
        now,

      updatedAt:
        now,

      version:
        shift.version + 1,
    },
  )
}