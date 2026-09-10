export type RepdbMediaVariant = 'start-peak' | 'main'

export interface RepdbMediaItem {
  readonly exerciseId: string
  readonly sourceId: string
  readonly variant: RepdbMediaVariant
}

export const REPDB_PACKAGE_VERSION: string
export const REPDB_MEDIA_ITEMS: readonly RepdbMediaItem[]
export const REPDB_PRECACHE_SOURCE_IDS: readonly string[]
