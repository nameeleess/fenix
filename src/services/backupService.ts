import {
  db,
} from '../db/database'

export interface FenixBackup {
  format: 'fenix-backup'

  formatVersion: 1

  exportedAt: string

  databaseName: string

  schemaVersion: string | null

  totalRecords: number

  tableCounts: Record<
    string,
    number
  >

  tables: Record<
    string,
    unknown[]
  >
}

export interface BackupExportResult {
  fileName: string

  totalRecords: number

  tableCounts: Record<
    string,
    number
  >

  method:
    | 'share'
    | 'download'
}

function createBackupFileName(
  exportedAt: string,
) {
  const safeTimestamp =
    exportedAt
      .replace(
        /[:.]/g,
        '-',
      )

  return `fenix-backup-${safeTimestamp}.json`
}

function isAppleMobileDevice() {
  const userAgent =
    navigator.userAgent

  const classicIOS =
    /iPhone|iPad|iPod/i.test(
      userAgent,
    )

  const modernIPad =
    navigator.platform ===
      'MacIntel' &&
    navigator.maxTouchPoints > 1

  return (
    classicIOS ||
    modernIPad
  )
}

async function buildBackup():
  Promise<FenixBackup> {
  await db.open()

  const tables: Record<
    string,
    unknown[]
  > = {}

  const tableCounts: Record<
    string,
    number
  > = {}

  let totalRecords = 0

  for (
    const table
    of db.tables
  ) {
    const records =
      await table.toArray()

    tables[table.name] =
      records

    tableCounts[
      table.name
    ] =
      records.length

    totalRecords +=
      records.length
  }

  const schemaMeta =
    await db.appMeta.get(
      'schemaVersion',
    )

  return {
    format:
      'fenix-backup',

    formatVersion: 1,

    exportedAt:
      new Date()
        .toISOString(),

    databaseName:
      db.name,

    schemaVersion:
      schemaMeta?.value ??
      null,

    totalRecords,

    tableCounts,

    tables,
  }
}

function downloadBackup(
  file: File,
) {
  const url =
    URL.createObjectURL(
      file,
    )

  const anchor =
    document.createElement(
      'a',
    )

  anchor.href = url

  anchor.download =
    file.name

  anchor.style.display =
    'none'

  document.body.appendChild(
    anchor,
  )

  anchor.click()

  anchor.remove()

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      )
    },
    1000,
  )
}

export async function exportFenixBackup():
  Promise<BackupExportResult> {
  const backup =
    await buildBackup()

  const fileName =
    createBackupFileName(
      backup.exportedAt,
    )

  const json =
    JSON.stringify(
      backup,
      null,
      2,
    )

  const file =
    new File(
      [
        json,
      ],
      fileName,
      {
        type:
          'application/json',
      },
    )

  const canShareFile =
    isAppleMobileDevice() &&
    typeof navigator.share ===
      'function' &&
    typeof navigator.canShare ===
      'function' &&
    navigator.canShare({
      files: [
        file,
      ],
    })

  if (
    canShareFile
  ) {
    await navigator.share({
      title:
        'Copia de seguridad FÉNIX',

      text:
        'Copia completa de los datos locales de FÉNIX.',

      files: [
        file,
      ],
    })

    return {
      fileName,

      totalRecords:
        backup.totalRecords,

      tableCounts:
        backup.tableCounts,

      method:
        'share',
    }
  }

  downloadBackup(
    file,
  )

  return {
    fileName,

    totalRecords:
      backup.totalRecords,

    tableCounts:
      backup.tableCounts,

    method:
      'download',
  }
}