import type { Table } from 'dexie'
import {
  CURRENT_SCHEMA_VERSION,
  db,
} from '../db/database'

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

export interface BackupExportResult {
  fileName: string
  totalRecords: number
  tableCounts: Record<string, number>
  method: 'share' | 'download'
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  schemaVersion: number | null
  totalRecords: number | null
  tableCounts: Record<string, number>
}

const knownTables = new Set([
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
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createBackupFileName(exportedAt: string) {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-')
  return `fenix-backup-${safeTimestamp}.json`
}

function isAppleMobileDevice() {
  const userAgent = navigator.userAgent
  const classicIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const modernIPad =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return classicIOS || modernIPad
}

async function buildBackup(): Promise<FenixBackup> {
  await db.open()

  const tables: Record<string, unknown[]> = {}
  const tableCounts: Record<string, number> = {}
  let totalRecords = 0

  for (const table of db.tables) {
    const records = await table.toArray()
    tables[table.name] = records
    tableCounts[table.name] = records.length
    totalRecords += records.length
  }

  const schemaMeta = await db.appMeta.get('schemaVersion')

  return {
    format: 'fenix-backup',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    databaseName: db.name,
    schemaVersion: schemaMeta?.value ?? String(CURRENT_SCHEMA_VERSION),
    totalRecords,
    tableCounts,
    tables,
  }
}

function downloadBackup(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = file.name
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportFenixBackup(): Promise<BackupExportResult> {
  const backup = await buildBackup()
  const fileName = createBackupFileName(backup.exportedAt)
  const json = JSON.stringify(backup, null, 2)
  const file = new File([json], fileName, {
    type: 'application/json',
  })

  const canShareFile =
    isAppleMobileDevice() &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFile) {
    await navigator.share({
      title: 'Copia de seguridad FÉNIX',
      text: 'Copia completa de los datos locales de FÉNIX.',
      files: [file],
    })

    return {
      fileName,
      totalRecords: backup.totalRecords,
      tableCounts: backup.tableCounts,
      method: 'share',
    }
  }

  downloadBackup(file)

  return {
    fileName,
    totalRecords: backup.totalRecords,
    tableCounts: backup.tableCounts,
    method: 'download',
  }
}

function getTableRecords(
  backup: FenixBackup,
  tableName: string,
): Record<string, unknown>[] {
  const records = backup.tables[tableName]

  if (!Array.isArray(records)) {
    return []
  }

  return records.filter(isRecord)
}

function idSet(records: Record<string, unknown>[], key = 'id') {
  return new Set(
    records
      .map((record) => record[key])
      .filter((value): value is string => typeof value === 'string'),
  )
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
  options?: { optional?: boolean },
) {
  for (const record of records) {
    const value = record[field]

    if ((value === null || value === undefined || value === '') && options?.optional) {
      continue
    }

    if (typeof value !== 'string' || !targetIds.has(value)) {
      const id = typeof record.id === 'string' ? record.id : 'sin-id'
      errors.push(`${tableName}:${id} referencia ${field} inexistente.`)
    }
  }
}

export function validateFenixBackup(value: unknown): BackupValidationResult {
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

  if (value.format !== 'fenix-backup') {
    errors.push('Formato de archivo no reconocido como backup FÉNIX.')
  }

  if (value.formatVersion !== 1) {
    errors.push('La versión del formato de backup no es compatible.')
  }

  if (value.databaseName !== 'fenix-db') {
    errors.push('El backup no pertenece a la base local de FÉNIX.')
  }

  const schemaVersionRaw = value.schemaVersion
  const schemaVersion =
    typeof schemaVersionRaw === 'string' && /^\d+$/.test(schemaVersionRaw)
      ? Number(schemaVersionRaw)
      : null

  if (schemaVersion === null) {
    errors.push('El backup no declara una versión de esquema válida.')
  } else if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `El backup usa el esquema v${schemaVersion}, más nuevo que esta app (v${CURRENT_SCHEMA_VERSION}).`,
    )
  }

  if (!isRecord(value.tables)) {
    errors.push('El backup no contiene una colección de tablas válida.')
  }

  if (!isRecord(value.tableCounts)) {
    errors.push('El backup no contiene contadores de tablas válidos.')
  }

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
    if (!knownTables.has(tableName)) {
      errors.push(`El backup contiene una tabla desconocida: ${tableName}.`)
    }
  }

  let calculatedTotal = 0

  for (const [tableName, records] of Object.entries(tables)) {
    calculatedTotal += records.length

    const declared = tableCounts[tableName]

    if (declared === undefined) {
      errors.push(`${tableName}: falta su contador declarado.`)
    } else if (declared !== records.length) {
      errors.push(
        `${tableName}: el contador declara ${declared}, pero contiene ${records.length} registros.`,
      )
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
    errors.push(
      `El backup declara ${totalRecords} registros, pero contiene ${calculatedTotal}.`,
    )
  }

  const appMeta = getTableRecords({ ...value, tables } as unknown as FenixBackup, 'appMeta')
  validateDuplicateKeys(errors, 'appMeta', appMeta, 'key')

  for (const [tableName, rawRecords] of Object.entries(tables)) {
    if (tableName === 'appMeta') {
      continue
    }

    validateDuplicateKeys(
      errors,
      tableName,
      rawRecords.filter(isRecord),
      'id',
    )
  }

  const backup = {
    ...(value as unknown as FenixBackup),
    tables,
    tableCounts,
  }

  const exercises = idSet(getTableRecords(backup, 'exercises'))
  const workoutTemplates = idSet(getTableRecords(backup, 'workoutTemplates'))
  const workoutSessions = idSet(getTableRecords(backup, 'workoutSessions'))
  const plannedSessions = idSet(getTableRecords(backup, 'plannedWorkoutSessions'))
  const ingredients = idSet(getTableRecords(backup, 'ingredients'))
  const recipes = idSet(getTableRecords(backup, 'recipes'))
  const weeklyPlans = idSet(getTableRecords(backup, 'weeklyNutritionPlans'))
  const routineTemplates = idSet(getTableRecords(backup, 'dailyRoutineTemplates'))
  const dailyRoutines = idSet(getTableRecords(backup, 'dailyRoutines'))

  validateReference(
    errors,
    'workoutTemplateExercises',
    getTableRecords(backup, 'workoutTemplateExercises'),
    'workoutTemplateId',
    workoutTemplates,
  )
  validateReference(
    errors,
    'workoutTemplateExercises',
    getTableRecords(backup, 'workoutTemplateExercises'),
    'exerciseId',
    exercises,
  )
  validateReference(
    errors,
    'workoutSessions',
    getTableRecords(backup, 'workoutSessions'),
    'workoutTemplateId',
    workoutTemplates,
  )
  validateReference(
    errors,
    'exerciseSets',
    getTableRecords(backup, 'exerciseSets'),
    'workoutSessionId',
    workoutSessions,
  )
  validateReference(
    errors,
    'exerciseSets',
    getTableRecords(backup, 'exerciseSets'),
    'exerciseId',
    exercises,
  )
  validateReference(
    errors,
    'plannedWorkoutSessions',
    getTableRecords(backup, 'plannedWorkoutSessions'),
    'workoutTemplateId',
    workoutTemplates,
  )
  validateReference(
    errors,
    'plannedWorkoutSessions',
    getTableRecords(backup, 'plannedWorkoutSessions'),
    'executionSessionId',
    workoutSessions,
    { optional: true },
  )
  validateReference(
    errors,
    'workoutSessionExercises',
    getTableRecords(backup, 'workoutSessionExercises'),
    'workoutSessionId',
    workoutSessions,
  )
  validateReference(
    errors,
    'workoutSessionExercises',
    getTableRecords(backup, 'workoutSessionExercises'),
    'exerciseId',
    exercises,
  )
  validateReference(
    errors,
    'recipeIngredients',
    getTableRecords(backup, 'recipeIngredients'),
    'recipeId',
    recipes,
  )
  validateReference(
    errors,
    'recipeIngredients',
    getTableRecords(backup, 'recipeIngredients'),
    'ingredientId',
    ingredients,
  )
  validateReference(
    errors,
    'shoppingItems',
    getTableRecords(backup, 'shoppingItems'),
    'ingredientId',
    ingredients,
  )
  validateReference(
    errors,
    'dailyMeals',
    getTableRecords(backup, 'dailyMeals'),
    'recipeId',
    recipes,
    { optional: true },
  )
  validateReference(
    errors,
    'dailyMeals',
    getTableRecords(backup, 'dailyMeals'),
    'trainingSessionId',
    plannedSessions,
    { optional: true },
  )
  validateReference(
    errors,
    'weeklyNutritionPlanMeals',
    getTableRecords(backup, 'weeklyNutritionPlanMeals'),
    'weeklyPlanId',
    weeklyPlans,
  )
  validateReference(
    errors,
    'weeklyNutritionPlanMeals',
    getTableRecords(backup, 'weeklyNutritionPlanMeals'),
    'recipeId',
    recipes,
    { optional: true },
  )
  validateReference(
    errors,
    'dailyRoutineTemplateItems',
    getTableRecords(backup, 'dailyRoutineTemplateItems'),
    'templateId',
    routineTemplates,
  )
  validateReference(
    errors,
    'dailyRoutines',
    getTableRecords(backup, 'dailyRoutines'),
    'templateId',
    routineTemplates,
    { optional: true },
  )
  validateReference(
    errors,
    'dailyRoutineTasks',
    getTableRecords(backup, 'dailyRoutineTasks'),
    'dailyRoutineId',
    dailyRoutines,
  )
  validateReference(
    errors,
    'progressFeaturedExercises',
    getTableRecords(backup, 'progressFeaturedExercises'),
    'exerciseId',
    exercises,
  )

  if (schemaVersion !== null && schemaVersion < CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `Backup v${schemaVersion}: se restaurará sobre la estructura actual v${CURRENT_SCHEMA_VERSION} y las tablas nuevas ausentes quedarán vacías.`,
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

export async function readAndValidateBackupFile(file: File) {
  let parsed: unknown

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('El archivo no contiene JSON válido.')
  }

  const validation = validateFenixBackup(parsed)

  return {
    backup: validation.valid ? (parsed as FenixBackup) : null,
    validation,
  }
}

export async function restoreFenixBackup(backup: FenixBackup) {
  const validation = validateFenixBackup(backup)

  if (!validation.valid) {
    throw new Error('El backup no ha superado la validación de integridad.')
  }

  await db.open()

  const currentTables = [...db.tables]

  await db.transaction('rw', currentTables, async () => {
    for (const table of currentTables) {
      await table.clear()
    }

    for (const [tableName, records] of Object.entries(backup.tables)) {
      const table = currentTables.find((item) => item.name === tableName)

      if (!table || records.length === 0) {
        continue
      }

      const writableTable = table as Table<Record<string, unknown>, string>
      await writableTable.bulkPut(records.filter(isRecord))
    }

    await db.appMeta.put({
      key: 'schemaVersion',
      value: String(CURRENT_SCHEMA_VERSION),
      updatedAt: new Date().toISOString(),
    })
  })
}
