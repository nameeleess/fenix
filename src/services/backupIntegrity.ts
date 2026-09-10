import {
  normalizeIngredientName,
  normalizeShoppingUnit,
} from '../features/nutrition/nutritionLibraryIdentity.ts'

export interface FenixBackup {
  format: 'fenix-backup'
  formatVersion: 1
  exportedAt: string
  databaseName: string
  schemaVersion: string | null
  totalRecords: number
  tableCounts: Record<string, number>
  tables: Record<string, unknown[]>
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  schemaVersion: number | null
  totalRecords: number | null
  tableCounts: Record<string, number>
}

export const SCHEMA_5_TABLES = [
  'appMeta',
  'exercises',
  'workoutTemplates',
  'workoutTemplateExercises',
  'workoutSessions',
  'exerciseSets',
  'plannedWorkoutSessions',
  'workoutSessionExercises',
  'ingredients',
  'recipes',
  'recipeIngredients',
  'shoppingItems',
  'nutritionDays',
  'dailyMeals',
  'nutritionGoals',
  'weeklyNutritionPlans',
  'weeklyNutritionPlanMeals',
  'dailyRoutineTemplates',
  'dailyRoutineTemplateItems',
  'dailyRoutines',
  'dailyRoutineTasks',
  'workShifts',
  'weightEntries',
  'bodyMeasurements',
  'progressGoals',
  'progressFeaturedExercises',
] as const

const knownTables = new Set<string>(SCHEMA_5_TABLES)

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getTableRecords(
  backup: Pick<FenixBackup, 'tables'>,
  tableName: string,
): Record<string, unknown>[] {
  const records = backup.tables[tableName]
  return Array.isArray(records) ? records.filter(isRecord) : []
}

function idSet(records: Record<string, unknown>[], key = 'id') {
  return new Set(
    records
      .map((record) => record[key])
      .filter((value): value is string => typeof value === 'string'),
  )
}

function recordMap(records: Record<string, unknown>[], key = 'id') {
  return new Map(
    records
      .map((record) => [record[key], record] as const)
      .filter((entry): entry is readonly [string, Record<string, unknown>] =>
        typeof entry[0] === 'string',
      ),
  )
}

function isActive(record: Record<string, unknown> | undefined) {
  return Boolean(record) && record?.deletedAt === null
}

function validateDuplicateKeys(
  errors: string[],
  tableName: string,
  records: Record<string, unknown>[],
  key: string,
) {
  const seen = new Set<string>()

  for (const record of records) {
    const value = record[key]

    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${tableName}: existe un registro sin ${key} válido.`)
      continue
    }

    if (seen.has(value)) {
      errors.push(`${tableName}: ${key} duplicado (${value}).`)
    }

    seen.add(value)
  }
}

function validateReference(
  errors: string[],
  tableName: string,
  records: Record<string, unknown>[],
  field: string,
  targetIds: Set<string>,
  options?: { optional?: boolean; requiredWhenActive?: boolean },
) {
  for (const record of records) {
    const value = record[field]
    const missing = value === null || value === undefined || value === ''

    if (missing && options?.optional && !(options.requiredWhenActive && record.deletedAt === null)) {
      continue
    }

    if (typeof value !== 'string' || !targetIds.has(value)) {
      const id = typeof record.id === 'string' ? record.id : 'sin-id'
      errors.push(`${tableName}:${id} referencia ${field} inexistente.`)
    }
  }
}

function validateActiveParent(
  errors: string[],
  tableName: string,
  records: Record<string, unknown>[],
  field: string,
  parents: Map<string, Record<string, unknown>>,
  parentLabel: string,
  options?: { optional?: boolean },
) {
  for (const record of records) {
    if (record.deletedAt !== null) continue

    const value = record[field]
    if ((value === null || value === undefined || value === '') && options?.optional) {
      continue
    }

    const parent = typeof value === 'string' ? parents.get(value) : undefined
    if (!isActive(parent)) {
      const id = typeof record.id === 'string' ? record.id : 'sin-id'
      errors.push(`${tableName}:${id} tiene ${parentLabel} inexistente o soft-deleted.`)
    }
  }
}

function validateUniqueActiveField(
  errors: string[],
  tableName: string,
  records: Record<string, unknown>[],
  field: string,
) {
  const seen = new Set<string>()
  for (const record of records) {
    if (record.deletedAt !== null) continue
    const value = record[field]
    if (typeof value !== 'string' || value.length === 0) continue
    if (seen.has(value)) {
      errors.push(`${tableName}: valor activo duplicado para ${field} (${value}).`)
    }
    seen.add(value)
  }
}

function validateActiveIngredientNameUniqueness(
  errors: string[],
  ingredients: Record<string, unknown>[],
) {
  const seen = new Map<string, string>()

  for (const ingredient of ingredients) {
    if (ingredient.deletedAt !== null || typeof ingredient.name !== 'string') continue

    const normalized = normalizeIngredientName(ingredient.name)
    const id = typeof ingredient.id === 'string' ? ingredient.id : 'sin-id'
    const previousId = seen.get(normalized)

    if (previousId !== undefined) {
      errors.push(
        `ingredients:${id} duplica el nombre lógico activo de ingredients:${previousId} (${normalized}).`,
      )
      continue
    }

    seen.set(normalized, id)
  }
}

function validateActiveShoppingItemIdentityUniqueness(
  errors: string[],
  shoppingItems: Record<string, unknown>[],
) {
  const seen = new Map<string, string>()

  for (const item of shoppingItems) {
    if (item.deletedAt !== null || typeof item.ingredientId !== 'string') continue

    const rawUnit = item.unit
    if (rawUnit !== null && rawUnit !== undefined && typeof rawUnit !== 'string') continue

    const normalizedUnit = normalizeShoppingUnit(rawUnit as string | null | undefined)
    const identity = JSON.stringify([item.ingredientId, normalizedUnit])
    const id = typeof item.id === 'string' ? item.id : 'sin-id'
    const previousId = seen.get(identity)

    if (previousId !== undefined) {
      errors.push(
        `shoppingItems:${id} duplica la identidad lógica activa de shoppingItems:${previousId} para ingredientId=${item.ingredientId} y unit=${String(normalizedUnit)}.`,
      )
      continue
    }

    seen.set(identity, id)
  }
}

function validateCompletedExerciseSetDomain(
  errors: string[],
  sets: Record<string, unknown>[],
) {
  for (const set of sets) {
    if (set.deletedAt !== null || set.completedAt === null) continue
    const id = typeof set.id === 'string' ? set.id : 'sin-id'
    const reps = set.reps
    const weight = set.weight
    const rir = set.rir
    const setType = set.setType

    if (typeof reps !== 'number' || !Number.isFinite(reps) || !Number.isInteger(reps) || reps < 1) {
      errors.push(`exerciseSets:${id} completada con reps inválidas.`)
    }
    if (weight !== null && (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)) {
      errors.push(`exerciseSets:${id} completada con weight inválido.`)
    }
    if (setType === 'warmup') {
      if (rir !== null) errors.push(`exerciseSets:${id} warmup completada con RIR no-null.`)
    } else if (
      rir !== null &&
      (typeof rir !== 'number' || !Number.isFinite(rir) || rir < 0 || rir > 10)
    ) {
      errors.push(`exerciseSets:${id} completada con RIR inválido.`)
    }
  }
}

function validatePlannedExecutionIntegrity(
  errors: string[],
  planned: Record<string, unknown>[],
  workoutSessionMap: Map<string, Record<string, unknown>>,
) {
  for (const session of planned) {
    if (session.deletedAt !== null) continue
    const id = typeof session.id === 'string' ? session.id : 'sin-id'
    const executionId = session.executionSessionId
    const status = session.status

    if (status === 'pending' || status === 'omitted') {
      if (executionId !== null) {
        errors.push(`plannedWorkoutSessions:${id} ${String(status)} con executionSessionId no-null.`)
      }
      continue
    }

    if (typeof executionId !== 'string') {
      errors.push(`plannedWorkoutSessions:${id} ${String(status)} sin executionSessionId válido.`)
      continue
    }

    const execution = workoutSessionMap.get(executionId)
    if (!execution || execution.deletedAt !== null) {
      errors.push(`plannedWorkoutSessions:${id} referencia ejecución inexistente/soft-deleted.`)
      continue
    }

    if (execution.plannedWorkoutId !== session.id) {
      errors.push(`plannedWorkoutSessions:${id} no coincide con plannedWorkoutId de su ejecución.`)
    }
    if (execution.workoutTemplateId !== session.workoutTemplateId) {
      errors.push(`plannedWorkoutSessions:${id} no coincide con workoutTemplateId de su ejecución.`)
    }

    const expectedExecutionStatus =
      status === 'in_progress' ? 'active' : status === 'completed' ? 'completed' : 'incomplete'
    if (execution.status !== expectedExecutionStatus) {
      errors.push(
        `plannedWorkoutSessions:${id} estado ${String(status)} incompatible con ejecución ${String(execution.status)}.`,
      )
    }
  }
}

function validateReversePlannedExecutionIntegrity(
  errors: string[],
  workoutSessions: Record<string, unknown>[],
  plannedMap: Map<string, Record<string, unknown>>,
) {
  const expectedPlannedStatus: Record<string, string | undefined> = {
    active: 'in_progress',
    completed: 'completed',
    incomplete: 'incomplete',
  }

  for (const execution of workoutSessions) {
    if (execution.deletedAt !== null || typeof execution.plannedWorkoutId !== 'string') {
      continue
    }

    const id = typeof execution.id === 'string' ? execution.id : 'sin-id'
    const planned = plannedMap.get(execution.plannedWorkoutId)

    if (!planned || planned.deletedAt !== null) {
      errors.push(`workoutSessions:${id} referencia PlannedWorkoutSession inexistente/soft-deleted.`)
      continue
    }

    const expectedStatus = expectedPlannedStatus[String(execution.status)]

    if (!expectedStatus) {
      errors.push(
        `workoutSessions:${id} estado ${String(execution.status)} incompatible con plannedWorkoutId operativo.`,
      )
      continue
    }

    if (planned.status !== expectedStatus) {
      errors.push(
        `workoutSessions:${id} estado ${String(execution.status)} incompatible con PlannedWorkoutSession ${String(planned.status)}.`,
      )
    }

    if (planned.executionSessionId !== execution.id) {
      errors.push(`workoutSessions:${id} no coincide con executionSessionId de su PlannedWorkoutSession.`)
    }

    if (planned.workoutTemplateId !== execution.workoutTemplateId) {
      errors.push(`workoutSessions:${id} no coincide con workoutTemplateId de su PlannedWorkoutSession.`)
    }
  }
}

function validateOperationalTemplateParents(
  errors: string[],
  planned: Record<string, unknown>[],
  workoutSessions: Record<string, unknown>[],
  templateMap: Map<string, Record<string, unknown>>,
) {
  for (const session of planned) {
    if (
      session.deletedAt !== null ||
      (session.status !== 'pending' && session.status !== 'in_progress')
    ) {
      continue
    }

    const id = typeof session.id === 'string' ? session.id : 'sin-id'
    const template = typeof session.workoutTemplateId === 'string'
      ? templateMap.get(session.workoutTemplateId)
      : undefined

    if (!isActive(template)) {
      errors.push(
        `plannedWorkoutSessions:${id} operativa referencia WorkoutTemplate inexistente/soft-deleted.`,
      )
    }
  }

  for (const session of workoutSessions) {
    if (session.deletedAt !== null || session.status !== 'active') {
      continue
    }

    const id = typeof session.id === 'string' ? session.id : 'sin-id'
    const template = typeof session.workoutTemplateId === 'string'
      ? templateMap.get(session.workoutTemplateId)
      : undefined

    if (!isActive(template)) {
      errors.push(
        `workoutSessions:${id} active referencia WorkoutTemplate inexistente/soft-deleted.`,
      )
    }
  }
}

function validateTerminalSessionCompletedWork(
  errors: string[],
  workoutSessions: Record<string, unknown>[],
  exerciseSets: Record<string, unknown>[],
) {
  for (const session of workoutSessions) {
    if (
      session.deletedAt !== null ||
      (session.status !== 'completed' && session.status !== 'incomplete')
    ) {
      continue
    }

    const sessionId = typeof session.id === 'string' ? session.id : null
    if (!sessionId) continue

    const hasCompletedWorkingSet = exerciseSets.some(
      (set) =>
        set.deletedAt === null &&
        set.workoutSessionId === sessionId &&
        set.setType === 'working' &&
        set.completedAt !== null,
    )

    if (!hasCompletedWorkingSet) {
      errors.push(
        `workoutSessions:${sessionId} ${String(session.status)} sin ninguna working ExerciseSet activa completada.`,
      )
    }
  }
}

function validateNutritionGoalSingleton(
  errors: string[],
  goals: Record<string, unknown>[],
) {
  const active = goals.filter(
    (goal) => goal.deletedAt === null && goal.endsOn === null,
  )

  if (active.length > 1) {
    errors.push(`nutritionGoals: existen ${active.length} objetivos activos simultáneos.`)
  }
}

function validatePendingTrainingMealIdentity(
  errors: string[],
  meals: Record<string, unknown>[],
) {
  const seen = new Set<string>()
  for (const meal of meals) {
    if (
      meal.deletedAt !== null ||
      meal.status !== 'pending' ||
      (meal.role !== 'preworkout' && meal.role !== 'postworkout') ||
      typeof meal.trainingSessionId !== 'string'
    ) {
      continue
    }

    const key = `${String(meal.date)}|${String(meal.role)}|${meal.trainingSessionId}`
    if (seen.has(key)) {
      errors.push(`dailyMeals: identidad Training pending duplicada (${key}).`)
    }
    seen.add(key)
  }
}

function validatePendingTrainingMealLifecycle(
  errors: string[],
  meals: Record<string, unknown>[],
  plannedMap: Map<string, Record<string, unknown>>,
) {
  for (const meal of meals) {
    if (
      meal.deletedAt !== null ||
      meal.status !== 'pending' ||
      (meal.role !== 'preworkout' && meal.role !== 'postworkout') ||
      typeof meal.trainingSessionId !== 'string'
    ) {
      continue
    }

    const id = typeof meal.id === 'string' ? meal.id : 'sin-id'
    const session = plannedMap.get(meal.trainingSessionId)

    if (!session) {
      errors.push(`dailyMeals:${id} Training pending referencia PlannedWorkoutSession inexistente.`)
      continue
    }

    if (session.deletedAt !== null) {
      errors.push(`dailyMeals:${id} Training pending referencia PlannedWorkoutSession soft-deleted.`)
      continue
    }

    if (session.status === 'omitted') {
      errors.push(`dailyMeals:${id} Training pending referencia PlannedWorkoutSession omitted.`)
      continue
    }

    if (meal.date !== session.scheduledDate) {
      errors.push(
        `dailyMeals:${id} Training pending en fecha ${String(meal.date)} distinta de su sesión ${String(session.scheduledDate)}.`,
      )
    }
  }
}

function validateActiveExerciseSetOrderUniqueness(
  errors: string[],
  sets: Record<string, unknown>[],
) {
  const seen = new Set<string>()

  for (const set of sets) {
    if (set.deletedAt !== null) continue

    const snapshotId = set.workoutSessionExerciseId
    const setType = set.setType
    const order = set.order

    if (
      typeof snapshotId !== 'string' ||
      typeof setType !== 'string' ||
      typeof order !== 'number' ||
      !Number.isFinite(order)
    ) {
      continue
    }

    const key = `${snapshotId}|${setType}|${String(order)}`
    if (seen.has(key)) {
      errors.push(`exerciseSets: order activo duplicado (${key}).`)
    }
    seen.add(key)
  }
}

export function validateFenixBackup(
  value: unknown,
  currentSchemaVersion = 5,
): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(value)) {
    return {
      valid: false,
      errors: ['El archivo no contiene un objeto de backup válido.'],
      warnings,
      schemaVersion: null,
      totalRecords: null,
      tableCounts: {},
    }
  }

  if (value.format !== 'fenix-backup') errors.push('Formato de archivo no reconocido como backup FÉNIX.')
  if (value.formatVersion !== 1) errors.push('La versión del formato de backup no es compatible.')
  if (value.databaseName !== 'fenix-db') errors.push('El backup no pertenece a la base local de FÉNIX.')

  const schemaVersionRaw = value.schemaVersion
  const schemaVersion =
    typeof schemaVersionRaw === 'string' && /^\d+$/.test(schemaVersionRaw)
      ? Number(schemaVersionRaw)
      : null

  if (schemaVersion === null) {
    errors.push('El backup no declara una versión de esquema válida.')
  } else if (schemaVersion > currentSchemaVersion) {
    errors.push(
      `El backup usa el esquema v${schemaVersion}, más nuevo que esta app (v${currentSchemaVersion}).`,
    )
  }

  if (!isRecord(value.tables)) errors.push('El backup no contiene una colección de tablas válida.')
  if (!isRecord(value.tableCounts)) errors.push('El backup no contiene contadores de tablas válidos.')

  const tables: Record<string, unknown[]> = isRecord(value.tables)
    ? Object.fromEntries(
        Object.entries(value.tables).filter(
          (entry): entry is [string, unknown[]] => Array.isArray(entry[1]),
        ),
      )
    : {}

  const tableCounts: Record<string, number> = isRecord(value.tableCounts)
    ? Object.fromEntries(
        Object.entries(value.tableCounts).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 0,
        ),
      )
    : {}

  for (const tableName of Object.keys(tables)) {
    if (!knownTables.has(tableName)) errors.push(`El backup contiene una tabla desconocida: ${tableName}.`)
  }
  for (const tableName of Object.keys(tableCounts)) {
    if (!knownTables.has(tableName)) errors.push(`El backup contiene un contador de tabla desconocida: ${tableName}.`)
  }

  if (schemaVersion === 5) {
    for (const tableName of SCHEMA_5_TABLES) {
      if (!Array.isArray(tables[tableName])) errors.push(`Falta la tabla obligatoria de schema 5: ${tableName}.`)
      if (tableCounts[tableName] === undefined) errors.push(`Falta el contador obligatorio de schema 5: ${tableName}.`)
    }
  }

  let calculatedTotal = 0
  for (const [tableName, records] of Object.entries(tables)) {
    calculatedTotal += records.length
    const declared = tableCounts[tableName]
    if (declared === undefined) {
      errors.push(`${tableName}: falta su contador declarado.`)
    } else if (declared !== records.length) {
      errors.push(`${tableName}: el contador declara ${declared}, pero contiene ${records.length} registros.`)
    }
  }

  const totalRecords =
    typeof value.totalRecords === 'number' &&
    Number.isInteger(value.totalRecords) &&
    value.totalRecords >= 0
      ? value.totalRecords
      : null

  if (totalRecords === null) {
    errors.push('El total de registros del backup no es válido.')
  } else if (totalRecords !== calculatedTotal) {
    errors.push(`El backup declara ${totalRecords} registros, pero contiene ${calculatedTotal}.`)
  }

  const backup: FenixBackup = {
    format: 'fenix-backup',
    formatVersion: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    databaseName: typeof value.databaseName === 'string' ? value.databaseName : '',
    schemaVersion: typeof value.schemaVersion === 'string' ? value.schemaVersion : null,
    totalRecords: totalRecords ?? 0,
    tableCounts,
    tables,
  }

  const appMeta = getTableRecords(backup, 'appMeta')
  if ((tables.appMeta ?? []).length !== appMeta.length) {
    errors.push('appMeta: todos los registros deben ser objetos válidos.')
  }
  validateDuplicateKeys(errors, 'appMeta', appMeta, 'key')
  const schemaMeta = appMeta.find((record) => record.key === 'schemaVersion')
  if (!schemaMeta) {
    errors.push('appMeta: falta schemaVersion.')
  } else if (schemaVersion !== null && schemaMeta.value !== String(schemaVersion)) {
    errors.push('appMeta: schemaVersion no coincide con la cabecera del backup.')
  }

  for (const [tableName, rawRecords] of Object.entries(tables)) {
    const records = rawRecords.filter(isRecord)
    if (records.length !== rawRecords.length) {
      errors.push(`${tableName}: todos los registros deben ser objetos válidos.`)
    }
    if (tableName !== 'appMeta') validateDuplicateKeys(errors, tableName, records, 'id')
  }

  const exercises = getTableRecords(backup, 'exercises')
  const templates = getTableRecords(backup, 'workoutTemplates')
  const templateExercises = getTableRecords(backup, 'workoutTemplateExercises')
  const workoutSessions = getTableRecords(backup, 'workoutSessions')
  const snapshots = getTableRecords(backup, 'workoutSessionExercises')
  const exerciseSets = getTableRecords(backup, 'exerciseSets')
  const planned = getTableRecords(backup, 'plannedWorkoutSessions')
  const ingredients = getTableRecords(backup, 'ingredients')
  const recipes = getTableRecords(backup, 'recipes')
  const recipeIngredients = getTableRecords(backup, 'recipeIngredients')
  const shoppingItems = getTableRecords(backup, 'shoppingItems')
  const nutritionDays = getTableRecords(backup, 'nutritionDays')
  const dailyMeals = getTableRecords(backup, 'dailyMeals')
  const nutritionGoals = getTableRecords(backup, 'nutritionGoals')
  const weeklyPlans = getTableRecords(backup, 'weeklyNutritionPlans')
  const weeklyMeals = getTableRecords(backup, 'weeklyNutritionPlanMeals')
  const routineTemplates = getTableRecords(backup, 'dailyRoutineTemplates')
  const routineItems = getTableRecords(backup, 'dailyRoutineTemplateItems')
  const dailyRoutines = getTableRecords(backup, 'dailyRoutines')
  const routineTasks = getTableRecords(backup, 'dailyRoutineTasks')
  const featured = getTableRecords(backup, 'progressFeaturedExercises')

  const exerciseIds = idSet(exercises)
  const templateIds = idSet(templates)
  const templateExerciseIds = idSet(templateExercises)
  const workoutSessionIds = idSet(workoutSessions)
  const snapshotIds = idSet(snapshots)
  const plannedIds = idSet(planned)
  const ingredientIds = idSet(ingredients)
  const recipeIds = idSet(recipes)
  const weeklyPlanIds = idSet(weeklyPlans)
  const routineTemplateIds = idSet(routineTemplates)
  const routineItemIds = idSet(routineItems)
  const dailyRoutineIds = idSet(dailyRoutines)

  validateReference(errors, 'workoutTemplateExercises', templateExercises, 'workoutTemplateId', templateIds)
  validateReference(errors, 'workoutTemplateExercises', templateExercises, 'exerciseId', exerciseIds)
  validateReference(errors, 'workoutSessions', workoutSessions, 'workoutTemplateId', templateIds)
  validateReference(errors, 'workoutSessions', workoutSessions, 'plannedWorkoutId', plannedIds, { optional: true })
  validateReference(errors, 'workoutSessionExercises', snapshots, 'workoutSessionId', workoutSessionIds)
  validateReference(errors, 'workoutSessionExercises', snapshots, 'sourceTemplateExerciseId', templateExerciseIds, { optional: true })
  validateReference(errors, 'workoutSessionExercises', snapshots, 'exerciseId', exerciseIds)
  validateReference(errors, 'exerciseSets', exerciseSets, 'workoutSessionId', workoutSessionIds)
  validateReference(errors, 'exerciseSets', exerciseSets, 'exerciseId', exerciseIds)
  validateReference(errors, 'exerciseSets', exerciseSets, 'workoutSessionExerciseId', snapshotIds, {
    optional: true,
    requiredWhenActive: schemaVersion === 5,
  })
  validateReference(errors, 'plannedWorkoutSessions', planned, 'workoutTemplateId', templateIds)
  validateReference(errors, 'plannedWorkoutSessions', planned, 'executionSessionId', workoutSessionIds, { optional: true })
  validateReference(errors, 'recipeIngredients', recipeIngredients, 'recipeId', recipeIds)
  validateReference(errors, 'recipeIngredients', recipeIngredients, 'ingredientId', ingredientIds)
  validateReference(errors, 'shoppingItems', shoppingItems, 'ingredientId', ingredientIds)
  validateReference(errors, 'dailyMeals', dailyMeals, 'recipeId', recipeIds, { optional: true })
  validateReference(errors, 'dailyMeals', dailyMeals, 'trainingSessionId', plannedIds, { optional: true })
  validateReference(errors, 'weeklyNutritionPlanMeals', weeklyMeals, 'weeklyPlanId', weeklyPlanIds)
  validateReference(errors, 'weeklyNutritionPlanMeals', weeklyMeals, 'recipeId', recipeIds, { optional: true })
  validateReference(errors, 'dailyRoutineTemplateItems', routineItems, 'templateId', routineTemplateIds)
  validateReference(errors, 'dailyRoutines', dailyRoutines, 'templateId', routineTemplateIds, { optional: true })
  validateReference(errors, 'dailyRoutineTasks', routineTasks, 'dailyRoutineId', dailyRoutineIds)
  validateReference(errors, 'dailyRoutineTasks', routineTasks, 'sourceTemplateItemId', routineItemIds, { optional: true })
  validateReference(errors, 'progressFeaturedExercises', featured, 'exerciseId', exerciseIds)

  const exerciseMap = recordMap(exercises)
  const templateMap = recordMap(templates)
  const sessionMap = recordMap(workoutSessions)
  const plannedMap = recordMap(planned)
  const snapshotMap = recordMap(snapshots)
  const ingredientMap = recordMap(ingredients)
  const recipeMap = recordMap(recipes)
  const weeklyPlanMap = recordMap(weeklyPlans)
  const routineTemplateMap = recordMap(routineTemplates)
  const dailyRoutineMap = recordMap(dailyRoutines)

  validateActiveParent(errors, 'workoutTemplateExercises', templateExercises, 'workoutTemplateId', templateMap, 'workoutTemplate')
  validateActiveParent(errors, 'workoutTemplateExercises', templateExercises, 'exerciseId', exerciseMap, 'exercise')
  validateActiveParent(errors, 'workoutSessionExercises', snapshots, 'workoutSessionId', sessionMap, 'workoutSession')
  validateActiveParent(errors, 'workoutSessionExercises', snapshots, 'exerciseId', exerciseMap, 'exercise')
  validateActiveParent(errors, 'exerciseSets', exerciseSets, 'workoutSessionId', sessionMap, 'workoutSession')
  validateActiveParent(errors, 'exerciseSets', exerciseSets, 'exerciseId', exerciseMap, 'exercise')
  validateActiveParent(errors, 'exerciseSets', exerciseSets, 'workoutSessionExerciseId', snapshotMap, 'workoutSessionExercise')
  validateActiveParent(errors, 'recipeIngredients', recipeIngredients, 'recipeId', recipeMap, 'recipe')
  validateActiveParent(errors, 'recipeIngredients', recipeIngredients, 'ingredientId', ingredientMap, 'ingredient')
  validateActiveParent(errors, 'shoppingItems', shoppingItems, 'ingredientId', ingredientMap, 'ingredient')
  validateActiveParent(errors, 'weeklyNutritionPlanMeals', weeklyMeals, 'weeklyPlanId', weeklyPlanMap, 'weeklyPlan')
  validateActiveParent(errors, 'dailyRoutineTemplateItems', routineItems, 'templateId', routineTemplateMap, 'routineTemplate')
  validateActiveParent(errors, 'dailyRoutineTasks', routineTasks, 'dailyRoutineId', dailyRoutineMap, 'dailyRoutine')
  validateActiveParent(errors, 'progressFeaturedExercises', featured, 'exerciseId', exerciseMap, 'exercise')

  for (const set of exerciseSets) {
    if (set.deletedAt !== null || typeof set.workoutSessionExerciseId !== 'string') continue
    const snapshot = snapshotMap.get(set.workoutSessionExerciseId)
    if (snapshot && snapshot.workoutSessionId !== set.workoutSessionId) {
      errors.push(`exerciseSets:${String(set.id)} snapshot/session linkage inconsistente.`)
    }
  }

  const activeWorkoutSessions = workoutSessions.filter(
    (session) => session.deletedAt === null && session.status === 'active',
  )
  if (activeWorkoutSessions.length > 1) {
    errors.push(`workoutSessions: existen ${activeWorkoutSessions.length} sesiones active simultáneas.`)
  }

  validateCompletedExerciseSetDomain(errors, exerciseSets)
  validateActiveExerciseSetOrderUniqueness(errors, exerciseSets)
  validatePlannedExecutionIntegrity(errors, planned, sessionMap)
  validateReversePlannedExecutionIntegrity(errors, workoutSessions, plannedMap)
  validateOperationalTemplateParents(errors, planned, workoutSessions, templateMap)
  validateTerminalSessionCompletedWork(errors, workoutSessions, exerciseSets)
  validateNutritionGoalSingleton(errors, nutritionGoals)
  validateActiveIngredientNameUniqueness(errors, ingredients)
  validateActiveShoppingItemIdentityUniqueness(errors, shoppingItems)
  validateUniqueActiveField(errors, 'dailyRoutines', dailyRoutines, 'date')
  validateUniqueActiveField(errors, 'nutritionDays', nutritionDays, 'date')
  validatePendingTrainingMealIdentity(errors, dailyMeals)
  validatePendingTrainingMealLifecycle(errors, dailyMeals, plannedMap)

  if (schemaVersion !== null && schemaVersion < currentSchemaVersion) {
    warnings.push(
      `Backup v${schemaVersion}: se restaurará sobre la estructura actual v${currentSchemaVersion} y las tablas nuevas ausentes quedarán vacías.`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    schemaVersion,
    totalRecords,
    tableCounts,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  )
}

function normalizedRecordForSemanticCompare(
  tableName: string,
  record: Record<string, unknown>,
) {
  if (tableName === 'appMeta' && record.key === 'schemaVersion') {
    const rest = Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== 'updatedAt'),
    )
    return canonicalize(rest)
  }
  return canonicalize(record)
}

export function semanticBackupDiff(expected: FenixBackup, actual: FenixBackup) {
  const errors: string[] = []
  if (expected.databaseName !== actual.databaseName) errors.push('databaseName distinto.')
  if (expected.schemaVersion !== actual.schemaVersion) errors.push('schemaVersion distinto.')

  for (const tableName of SCHEMA_5_TABLES) {
    const expectedRecords = getTableRecords(expected, tableName)
    const actualRecords = getTableRecords(actual, tableName)
    const key = tableName === 'appMeta' ? 'key' : 'id'
    const expectedMap = new Map(
      expectedRecords.map((record) => [String(record[key]), normalizedRecordForSemanticCompare(tableName, record)]),
    )
    const actualMap = new Map(
      actualRecords.map((record) => [String(record[key]), normalizedRecordForSemanticCompare(tableName, record)]),
    )

    if (expectedMap.size !== actualMap.size) {
      errors.push(`${tableName}: count semántico distinto (${expectedMap.size} != ${actualMap.size}).`)
      continue
    }

    for (const [recordKey, expectedRecord] of expectedMap) {
      if (!actualMap.has(recordKey)) {
        errors.push(`${tableName}: falta ${recordKey}.`)
        continue
      }
      const actualRecord = actualMap.get(recordKey)
      if (JSON.stringify(expectedRecord) !== JSON.stringify(actualRecord)) {
        errors.push(`${tableName}:${recordKey} difiere semánticamente.`)
      }
    }
  }

  return errors
}
