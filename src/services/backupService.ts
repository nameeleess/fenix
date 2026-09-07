import type { Table } from 'dexie'
import {
  CURRENT_SCHEMA_VERSION,
  db,
} from '../db/database'
import {
  SCHEMA_5_TABLES,
  getTableRecords,
  isRecord,
  semanticBackupDiff,
  validateFenixBackup as validateBackupIntegrity,
  type BackupValidationResult,
  type FenixBackup,
} from './backupIntegrity'

export type {
  BackupValidationResult,
  FenixBackup,
} from './backupIntegrity'

export interface BackupExportResult {
  fileName: string
  totalRecords: number
  tableCounts: Record<string, number>
  method: 'share' | 'download'
}

function createBackupFileName(exportedAt: string) {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-')
  return `fenix-backup-${safeTimestamp}.json`
}

function isAppleMobileDevice() {
  const userAgent = navigator.userAgent
  const classicIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const modernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return classicIOS || modernIPad
}

async function buildBackupInsideCurrentTransaction(
  tablesByName: Map<string, Table>,
  exportedAt = new Date().toISOString(),
): Promise<FenixBackup> {
  const tables: Record<string, unknown[]> = {}
  const tableCounts: Record<string, number> = {}
  let totalRecords = 0

  for (const tableName of SCHEMA_5_TABLES) {
    const table = tablesByName.get(tableName)
    if (!table) {
      throw new Error(`La base local no expone la tabla requerida ${tableName}.`)
    }

    const records = await table.toArray()
    tables[tableName] = records
    tableCounts[tableName] = records.length
    totalRecords += records.length
  }

  const schemaMeta = await db.appMeta.get('schemaVersion')

  return {
    format: 'fenix-backup',
    formatVersion: 1,
    exportedAt,
    databaseName: db.name,
    schemaVersion: schemaMeta?.value ?? String(CURRENT_SCHEMA_VERSION),
    totalRecords,
    tableCounts,
    tables,
  }
}

async function buildBackup(): Promise<FenixBackup> {
  await db.open()
  const currentTables = [...db.tables]
  const tablesByName = new Map(currentTables.map((table) => [table.name, table]))

  // Every table is read under one read-only transaction. This prevents a
  // parent/child mix assembled from different commit moments.
  return db.transaction('r', currentTables, async () =>
    buildBackupInsideCurrentTransaction(tablesByName),
  )
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
  const file = new File([json], fileName, { type: 'application/json' })

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

export function validateFenixBackup(value: unknown): BackupValidationResult {
  return validateBackupIntegrity(value, CURRENT_SCHEMA_VERSION)
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

function normalizeBackupForRestore(backup: FenixBackup): FenixBackup {
  const now = new Date().toISOString()
  const tables: Record<string, unknown[]> = {}
  const tableCounts: Record<string, number> = {}

  for (const tableName of SCHEMA_5_TABLES) {
    tables[tableName] = [...(backup.tables[tableName] ?? [])]
  }

  const appMeta = getTableRecords({ tables }, 'appMeta')
  const schemaMetaIndex = appMeta.findIndex((record) => record.key === 'schemaVersion')
  const schemaMeta = {
    key: 'schemaVersion',
    value: String(CURRENT_SCHEMA_VERSION),
    updatedAt: schemaMetaIndex >= 0 && typeof appMeta[schemaMetaIndex].updatedAt === 'string'
      ? appMeta[schemaMetaIndex].updatedAt
      : now,
  }

  if (schemaMetaIndex >= 0) {
    appMeta[schemaMetaIndex] = schemaMeta
  } else {
    appMeta.push(schemaMeta)
  }
  tables.appMeta = appMeta

  let totalRecords = 0
  for (const tableName of SCHEMA_5_TABLES) {
    tableCounts[tableName] = tables[tableName].length
    totalRecords += tables[tableName].length
  }

  return {
    ...backup,
    databaseName: 'fenix-db',
    schemaVersion: String(CURRENT_SCHEMA_VERSION),
    totalRecords,
    tableCounts,
    tables,
  }
}

export async function restoreFenixBackup(backup: FenixBackup) {
  // Full prevalidation is deliberately completed before opening the destructive
  // transaction. No clear() can run for an invalid backup.
  const validation = validateFenixBackup(backup)
  if (!validation.valid) {
    throw new Error('El backup no ha superado la validación de integridad.')
  }

  await db.open()
  const currentTables = [...db.tables]
  const tablesByName = new Map(currentTables.map((table) => [table.name, table]))
  const normalizedBackup = normalizeBackupForRestore(backup)

  await db.transaction('rw', currentTables, async () => {
    for (const table of currentTables) {
      await table.clear()
    }

    for (const tableName of SCHEMA_5_TABLES) {
      const table = tablesByName.get(tableName)
      if (!table) {
        throw new Error(`No existe la tabla ${tableName} durante la restauración.`)
      }

      const records = normalizedBackup.tables[tableName]
      if (records.length === 0) continue

      const writableTable = table as Table<Record<string, unknown>, string>
      await writableTable.bulkPut(records.filter(isRecord))
    }

    // Post-restore verification happens before the transaction is allowed to
    // commit. Any mismatch throws and Dexie rolls the clear+put back.
    const restored = await buildBackupInsideCurrentTransaction(
      tablesByName,
      normalizedBackup.exportedAt,
    )
    const restoredValidation = validateFenixBackup(restored)

    if (!restoredValidation.valid) {
      throw new Error(
        `La restauración no supera la verificación posterior: ${restoredValidation.errors.join(' | ')}`,
      )
    }

    const semanticErrors = semanticBackupDiff(normalizedBackup, restored)
    if (semanticErrors.length > 0) {
      throw new Error(
        `La restauración no coincide semánticamente con el backup: ${semanticErrors.join(' | ')}`,
      )
    }
  })
}
