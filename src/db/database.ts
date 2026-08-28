import Dexie, { type Table } from 'dexie'

export interface AppMeta {
  key: string
  value: string
  updatedAt: string
}

class FenixDatabase extends Dexie {
  appMeta!: Table<AppMeta, string>

  constructor() {
    super('fenix-db')

    this.version(1).stores({
      appMeta: '&key, updatedAt',
    })
  }
}

export const db = new FenixDatabase()

export async function initializeDatabase() {
  await db.open()

  const schemaVersion = await db.appMeta.get('schemaVersion')

  if (!schemaVersion) {
    await db.appMeta.put({
      key: 'schemaVersion',
      value: '1',
      updatedAt: new Date().toISOString(),
    })
  }
}