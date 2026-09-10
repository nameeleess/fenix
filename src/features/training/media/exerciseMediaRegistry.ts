import { USER_LICENSED_MEDIA } from './userMediaManifest.ts'

export interface ExerciseMediaDefinition {
  exerciseId: string
  staticAsset: string
  motionId: string
  source: 'repdb' | 'fenix' | 'user-licensed'
  sourceId: string | null
  attribution: string | null
  licenseRef: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string
  techniqueNotes: string[]
  offlinePolicy: 'precache-local' | 'package-local-cache-on-use'
  startAsset?: string | null
  peakAsset?: string | null
  fallbackAsset?: string
  fallbackAssets?: string[]
  motionProfile: {
    kind: string
    durationMs: number
    amplitude: number
    rotationDeg: number
    phase: number
  }
}

const REPDB_PACKAGE_VERSION = '2026.8.1'
const REPDB_ROOT = `/media/exercises/repdb/${REPDB_PACKAGE_VERSION}`
const REPDB_ATTRIBUTION = 'Exercise data & flat illustrations by RepDB — repdb.co'
const REPDB_LICENSE = '@repdb/exercises@2026.8.1 · LICENSE.md'
const FENIX_LICENSE = 'FÉNIX original asset — in-app use only'

function repdb(
  exerciseId: string,
  sourceId: string,
  muscles: string[],
  secondary: string[],
  equipment: string,
  kind: string,
  index: number,
  mainOnly = false,
): ExerciseMediaDefinition {
  const start = mainOnly ? `${REPDB_ROOT}/${sourceId}-main.webp` : `${REPDB_ROOT}/${sourceId}-start.webp`
  const peak = mainOnly ? null : `${REPDB_ROOT}/${sourceId}-peak.webp`
  return {
    exerciseId,
    staticAsset: start,
    startAsset: start,
    peakAsset: peak,
    motionId: `motion-${exerciseId}`,
    source: 'repdb',
    sourceId,
    attribution: REPDB_ATTRIBUTION,
    licenseRef: REPDB_LICENSE,
    primaryMuscles: muscles,
    secondaryMuscles: secondary,
    equipment,
    techniqueNotes: [],
    offlinePolicy: 'package-local-cache-on-use',
    motionProfile: {
      kind,
      durationMs: 2100 + (index % 7) * 170,
      amplitude: 4 + (index % 5) * 0.9,
      rotationDeg: ((index % 5) - 2) * 1.2,
      phase: (index * 37) % 360,
    },
  }
}

function fenix(
  exerciseId: string,
  sourceId: string,
  muscles: string[],
  secondary: string[],
  equipment: string,
  kind: string,
  index: number,
): ExerciseMediaDefinition {
  const asset = `/media/exercises/fenix/${sourceId}.webp`
  return {
    exerciseId,
    staticAsset: asset,
    fallbackAsset: `/media/exercises/fenix/${sourceId}.svg`,
    startAsset: asset,
    peakAsset: asset,
    motionId: `motion-${exerciseId}`,
    source: 'fenix',
    sourceId,
    attribution: null,
    licenseRef: FENIX_LICENSE,
    primaryMuscles: muscles,
    secondaryMuscles: secondary,
    equipment,
    techniqueNotes: [],
    offlinePolicy: 'precache-local',
    motionProfile: {
      kind,
      durationMs: 2200 + (index % 6) * 190,
      amplitude: 4.5 + (index % 4),
      rotationDeg: ((index % 7) - 3) * 1.15,
      phase: (index * 43) % 360,
    },
  }
}

export const LEGACY_EXERCISE_MEDIA_REGISTRY: readonly ExerciseMediaDefinition[] = [
  repdb('ex-bench-press','bench-press',['Pecho'],['Tríceps','Deltoides anteriores'],'Barra','press',1),
  repdb('ex-incline-dumbbell-press','incline-db-press',['Pecho'],['Tríceps','Deltoides anteriores'],'Mancuernas','incline-press',2),
  repdb('ex-cable-fly','cable-fly',['Pecho'],[],'Polea','fly',3),
  repdb('ex-pull-up','pull-up',['Espalda'],['Bíceps'],'Peso corporal','pull-up',4),
  repdb('ex-lat-pulldown','lat-pulldown',['Espalda'],['Bíceps'],'Polea','pulldown',5),
  repdb('ex-chest-supported-row','chest-supported-db-row',['Espalda'],['Bíceps','Deltoides posteriores'],'Mancuernas / máquina','row',6),
  fenix('ex-chest-supported-tbar-row','fenix-chest-supported-tbar-row',['Espalda'],['Bíceps','Deltoides posteriores'],'Máquina / T-Bar','tbar-row',7),
  repdb('ex-seated-cable-row','seated-cable-row',['Espalda'],['Bíceps'],'Polea','cable-row',8),
  repdb('ex-lateral-raise','lateral-raise',['Hombros'],[],'Mancuernas / polea','lateral-raise',9),
  repdb('ex-face-pull','face-pull',['Hombros'],['Espalda'],'Polea','face-pull',10),
  fenix('ex-bayesian-curl','fenix-bayesian-curl',['Bíceps'],[],'Polea','bayesian-curl',11),
  repdb('ex-incline-dumbbell-curl','incline-db-curl',['Bíceps'],[],'Mancuernas','incline-curl',12),
  repdb('ex-hammer-curl','hammer-curl',['Bíceps'],['Antebrazo'],'Mancuernas','hammer-curl',13),
  repdb('ex-ez-bar-curl','ez-bar-curl',['Bíceps'],[],'Barra EZ','ez-curl',14),
  repdb('ex-triceps-pushdown','tricep-pushdown',['Tríceps'],[],'Polea','pushdown',15),
  fenix('ex-overhead-triceps-extension','fenix-overhead-cable-triceps',['Tríceps'],[],'Polea','overhead-triceps',16),
  repdb('ex-hack-squat','hack-squat',['Cuádriceps'],['Glúteos'],'Máquina','hack-squat',17),
  repdb('ex-leg-press','leg-press',['Cuádriceps'],['Glúteos'],'Máquina','leg-press',18),
  repdb('ex-leg-extension','leg-extension',['Cuádriceps'],[],'Máquina','leg-extension',19),
  repdb('ex-leg-curl','leg-curl',['Isquiosurales'],[],'Máquina','lying-leg-curl',20),
  repdb('ex-hip-thrust','hip-thrust',['Glúteos'],['Isquiosurales'],'Barra / máquina','hip-thrust',21),
  repdb('ex-rdl','romanian-deadlift',['Isquiosurales'],['Glúteos'],'Barra','rdl',22),
  repdb('ex-seated-calf-raise','seated-calf-raise',['Gemelos'],[],'Máquina','seated-calf',23),
  repdb('ex-standing-calf-raise','standing-calf-raise',['Gemelos'],[],'Máquina','standing-calf',24),
  repdb('ex-cat-cow','cat-cow',['Movilidad'],['Columna'],'Suelo','cat-cow',25,true),
  fenix('ex-open-book','fenix-open-book',['Movilidad'],['Tórax','Hombros'],'Suelo','open-book',26),
  fenix('ex-90-90-hip-switch','fenix-9090-hip-switch',['Cadera'],['Glúteos'],'Suelo','hip-switch',27),
  repdb('ex-hip-flexor-stretch','kneeling-hip-flexor-stretch',['Cadera'],['Cuádriceps'],'Suelo','hip-flexor',28,true),
  fenix('ex-wall-slides','fenix-wall-slides',['Hombros'],['Espalda'],'Pared','wall-slide',29),
  repdb('ex-bird-dog','bird-dog',['Core'],['Glúteos','Espalda'],'Suelo','bird-dog',30),
  repdb('ex-dead-bug','dead-bug',['Core'],[],'Suelo','dead-bug',31),
  repdb('ex-side-plank','side-plank',['Core'],['Glúteos'],'Suelo','side-plank',32,true),
  fenix('ex-breathing-reset','fenix-breathing-mobility',['Recuperación'],[],'Suelo','breathing',33),
] as const

export const EXERCISE_MEDIA_REGISTRY: readonly ExerciseMediaDefinition[] = LEGACY_EXERCISE_MEDIA_REGISTRY.map(definition => {
  const licensed = USER_LICENSED_MEDIA[definition.exerciseId]
  if (!licensed) return definition
  return {
    ...definition,
    source: 'user-licensed',
    sourceId: definition.exerciseId,
    staticAsset: licensed.poster,
    startAsset: licensed.poster,
    peakAsset: licensed.peak,
    fallbackAsset: definition.staticAsset,
    fallbackAssets: [definition.staticAsset, ...(definition.fallbackAsset ? [definition.fallbackAsset] : [])],
    attribution: 'Gymvisual — media licenciada aportada por el usuario',
    licenseRef: 'CENTRAL user-media authorization; USER_MEDIA_LICENSE_REGISTRY.md',
    offlinePolicy: 'precache-local',
  }
})

export const EXERCISE_MEDIA_BY_ID = new Map(
  EXERCISE_MEDIA_REGISTRY.map((definition) => [definition.exerciseId, definition]),
)

export function getExerciseMedia(exerciseId: string) {
  return EXERCISE_MEDIA_BY_ID.get(exerciseId) ?? null
}
