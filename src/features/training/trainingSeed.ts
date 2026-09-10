import { db } from '../../db/database'
import { getLocalDateKey, parseDateKey, shiftDateKey } from '../../utils/date'
import { createUuid } from '../../utils/uuid'
import type {
  Exercise,
  WorkoutSessionExercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../types/training'

const PROGRAM_VERSION = '2'
const PROGRAM_MIGRATION_KEY = 'trainingProgramVersion'
const PLANNING_START_KEY = 'trainingPlanningStartDate'

function nowIso() {
  return new Date().toISOString()
}

function entityBase(id: string) {
  const now = nowIso()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function targetRirRange(config: WorkoutTemplateExercise | undefined) {
  if (!config) {
    return {
      min: null,
      max: null,
    }
  }

  return {
    min: config.targetRirMin ?? config.targetRir ?? null,
    max: config.targetRirMax ?? config.targetRir ?? null,
  }
}

async function preserveLegacySessionsBeforeProgramChange() {
  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutTemplateExercises,
    db.workoutSessionExercises,
    db.exerciseSets,
    async () => {
      const [sessions, templateConfigs] = await Promise.all([
        db.workoutSessions.toArray(),
        db.workoutTemplateExercises.toArray(),
      ])

      for (const session of sessions) {
        if (session.deletedAt !== null) {
          continue
        }

        const sets = (await db.exerciseSets
          .where('workoutSessionId')
          .equals(session.id)
          .toArray())
          .filter((set) => set.deletedAt === null)

        if (sets.length === 0) {
          continue
        }

        const snapshots = await db.workoutSessionExercises
          .where('workoutSessionId')
          .equals(session.id)
          .toArray()

        const snapshotsByExerciseId = new Map(
          snapshots
            .filter((item) => item.deletedAt === null)
            .map((item) => [item.exerciseId, item]),
        )

        const exerciseIds: string[] = []

        for (const set of sets) {
          if (!exerciseIds.includes(set.exerciseId)) {
            exerciseIds.push(set.exerciseId)
          }
        }

        for (const exerciseId of exerciseIds) {
          let snapshot = snapshotsByExerciseId.get(exerciseId)

          if (!snapshot) {
            const matchingSets = sets
              .filter((set) => set.exerciseId === exerciseId)
              .sort((a, b) => a.order - b.order)

            const config = templateConfigs.find(
              (item) =>
                item.deletedAt === null &&
                item.workoutTemplateId === session.workoutTemplateId &&
                item.exerciseId === exerciseId,
            )

            const rir = targetRirRange(config)
            const firstSet = matchingSets[0]

            const next: WorkoutSessionExercise = {
              ...entityBase(createUuid()),
              workoutSessionId: session.id,
              sourceTemplateExerciseId: config?.id ?? null,
              exerciseId,
              exerciseName: firstSet?.exerciseName ?? exerciseId,
              order: config?.order ?? exerciseIds.indexOf(exerciseId) + 1,
              targetSets:
                config?.targetSets ??
                matchingSets.filter((set) => set.setType === 'working').length,
              minReps: config?.minReps ?? 0,
              maxReps: config?.maxReps ?? 0,
              targetRirMin: rir.min,
              targetRirMax: rir.max,
              restSeconds: config?.restSeconds ?? 90,
              substitutedFromExerciseId: null,
              notes: null,
              targetSeconds: config?.targetSeconds ?? null,
            }

            await db.workoutSessionExercises.add(next)
            snapshot = next
            snapshotsByExerciseId.set(exerciseId, next)
          }

          for (const set of sets.filter((item) => item.exerciseId === exerciseId)) {
            if (set.workoutSessionExerciseId === snapshot.id) {
              continue
            }

            await db.exerciseSets.update(set.id, {
              workoutSessionExerciseId: snapshot.id,
              updatedAt: nowIso(),
              version: set.version + 1,
            })
          }
        }
      }
    },
  )
}

const exerciseDefinitions: Array<
  Omit<Exercise, 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>
> = [
  {
    id: 'ex-bench-press',
    name: 'Press banca',
    primaryMuscle: 'Pecho',
    secondaryMuscles: ['Tríceps', 'Deltoides anteriores'],
    equipment: 'Barra',
    exerciseType: 'compound',
    spineLoad: 'moderate',
    techniqueNotes:
      'Estabiliza la posición, utiliza un recorrido cómodo y controlado y evita perder tensión al final de la bajada.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-incline-dumbbell-press',
    name: 'Press inclinado con mancuernas',
    primaryMuscle: 'Pecho',
    secondaryMuscles: ['Tríceps', 'Deltoides anteriores'],
    equipment: 'Mancuernas',
    exerciseType: 'compound',
    spineLoad: 'moderate',
    techniqueNotes:
      'Controla la bajada y alcanza una posición suficientemente elongada sin forzar el hombro.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-cable-fly',
    name: 'Aperturas en polea',
    primaryMuscle: 'Pecho',
    secondaryMuscles: [],
    equipment: 'Polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Mantén el control y conserva una posición elongada útil sin convertir el movimiento en un press.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-pull-up',
    name: 'Dominadas',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Peso corporal',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes:
      'Usa un recorrido amplio y controlado y adapta el agarre a una posición cómoda.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Jalón al pecho',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Polea',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes:
      'Permite una extensión controlada arriba y dirige los codos hacia abajo sin impulso excesivo.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-chest-supported-row',
    name: 'Remo con pecho apoyado',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps', 'Deltoides posteriores'],
    equipment: 'Mancuernas / máquina',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes:
      'Mantén el pecho apoyado, deja que la escápula se mueva con control y evita convertirlo en un tirón corporal.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-chest-supported-tbar-row',
    name: 'Remo T con pecho apoyado',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps', 'Deltoides posteriores'],
    equipment: 'Máquina / T-Bar',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes:
      'Mantén el torso apoyado y utiliza un recorrido cómodo sin buscar inmovilidad absoluta.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-seated-cable-row',
    name: 'Remo sentado en polea',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps'],
    equipment: 'Polea',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes:
      'Permite una extensión controlada al inicio y rema evitando un impulso que desplace el trabajo fuera de la espalda.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-lateral-raise',
    name: 'Elevaciones laterales',
    primaryMuscle: 'Hombros',
    secondaryMuscles: [],
    equipment: 'Mancuernas / polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Eleva de forma controlada. Una pequeña ayuda corporal no invalida automáticamente la serie si conserva el estímulo y el control.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-face-pull',
    name: 'Face Pull',
    primaryMuscle: 'Hombros',
    secondaryMuscles: ['Espalda'],
    equipment: 'Polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Controla el movimiento y adapta la trayectoria a una posición cómoda del hombro.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-bayesian-curl',
    name: 'Curl Bayesian en polea',
    primaryMuscle: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Coloca el brazo ligeramente detrás del torso y conserva una posición elongada cómoda.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-incline-dumbbell-curl',
    name: 'Curl inclinado con mancuernas',
    primaryMuscle: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Mancuernas',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Mantén una posición elongada del bíceps y controla la repetición.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-hammer-curl',
    name: 'Curl martillo',
    primaryMuscle: 'Bíceps',
    secondaryMuscles: ['Antebrazo'],
    equipment: 'Mancuernas',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Agarre neutro y repetición controlada.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-ez-bar-curl',
    name: 'Curl con barra EZ',
    primaryMuscle: 'Bíceps',
    secondaryMuscles: [],
    equipment: 'Barra EZ',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Utiliza un recorrido cómodo y una excéntrica controlada.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-triceps-pushdown',
    name: 'Extensión de tríceps en polea',
    primaryMuscle: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Mantén una ejecución estable y alcanza una extensión cómoda.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-overhead-triceps-extension',
    name: 'Extensión de tríceps sobre la cabeza',
    primaryMuscle: 'Tríceps',
    secondaryMuscles: [],
    equipment: 'Polea',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Busca una posición elongada del tríceps sin forzar hombros o codos.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-hack-squat',
    name: 'Hack Squat',
    primaryMuscle: 'Cuádriceps',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Máquina',
    exerciseType: 'compound',
    spineLoad: 'moderate',
    techniqueNotes:
      'Desciende hasta un rango cómodo y controlable manteniendo una trayectoria estable.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-leg-press',
    name: 'Prensa de piernas',
    primaryMuscle: 'Cuádriceps',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Máquina',
    exerciseType: 'compound',
    spineLoad: 'moderate',
    techniqueNotes:
      'Utiliza el rango profundo que puedas controlar sin perder una posición estable.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-leg-extension',
    name: 'Extensión de cuádriceps',
    primaryMuscle: 'Cuádriceps',
    secondaryMuscles: [],
    equipment: 'Máquina',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Controla ambas fases de la repetición.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-leg-curl',
    name: 'Curl femoral',
    primaryMuscle: 'Isquiosurales',
    secondaryMuscles: [],
    equipment: 'Máquina',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes:
      'Controla la fase excéntrica y conserva el recorrido disponible.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-hip-thrust',
    name: 'Hip Thrust',
    primaryMuscle: 'Glúteos',
    secondaryMuscles: ['Isquiosurales'],
    equipment: 'Barra / máquina',
    exerciseType: 'compound',
    spineLoad: 'low',
    techniqueNotes: 'Extiende la cadera sin buscar hiperextensión lumbar.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-rdl',
    name: 'Peso muerto rumano',
    primaryMuscle: 'Isquiosurales',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Barra',
    exerciseType: 'compound',
    spineLoad: 'high',
    techniqueNotes:
      'Realiza una bisagra de cadera controlada y detén el descenso donde mantengas una posición sólida.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-seated-calf-raise',
    name: 'Elevación de gemelos sentado',
    primaryMuscle: 'Gemelos',
    secondaryMuscles: [],
    equipment: 'Máquina',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Utiliza un recorrido amplio y controlado.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-standing-calf-raise',
    name: 'Elevación de gemelos de pie',
    primaryMuscle: 'Gemelos',
    secondaryMuscles: [],
    equipment: 'Máquina',
    exerciseType: 'isolation',
    spineLoad: 'low',
    techniqueNotes: 'Utiliza un recorrido amplio y controlado.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-cat-cow',
    name: 'Cat Cow',
    primaryMuscle: 'Movilidad',
    secondaryMuscles: ['Columna'],
    equipment: 'Suelo',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Alterna las posiciones con respiración tranquila y sin forzar el final del recorrido.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-open-book',
    name: 'Open Book',
    primaryMuscle: 'Movilidad',
    secondaryMuscles: ['Tórax', 'Hombros'],
    equipment: 'Suelo',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Rota de forma cómoda siguiendo la mano con la mirada.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-90-90-hip-switch',
    name: '90/90 Hip Switch',
    primaryMuscle: 'Cadera',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Suelo',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Cambia de lado con control y usa apoyo de manos si mejora la calidad del movimiento.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-hip-flexor-stretch',
    name: 'Estiramiento flexor de cadera',
    primaryMuscle: 'Cadera',
    secondaryMuscles: ['Cuádriceps'],
    equipment: 'Suelo',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Busca una tensión cómoda en la parte anterior de la cadera sin arquear en exceso la zona lumbar.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-wall-slides',
    name: 'Wall Slides',
    primaryMuscle: 'Hombros',
    secondaryMuscles: ['Espalda'],
    equipment: 'Pared',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Desliza los brazos manteniendo un rango cómodo y sin forzar la posición.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-bird-dog',
    name: 'Bird Dog',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Glúteos', 'Espalda'],
    equipment: 'Suelo',
    exerciseType: 'core',
    spineLoad: 'low',
    techniqueNotes: 'Extiende brazo y pierna contrarios conservando una posición estable y respiración normal.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-dead-bug',
    name: 'Dead Bug',
    primaryMuscle: 'Core',
    secondaryMuscles: [],
    equipment: 'Suelo',
    exerciseType: 'core',
    spineLoad: 'low',
    techniqueNotes: 'Mueve las extremidades sin perder el control de la posición del tronco.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-side-plank',
    name: 'Plancha lateral',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Glúteos'],
    equipment: 'Suelo',
    exerciseType: 'core',
    spineLoad: 'low',
    techniqueNotes: 'Mantén una posición firme y detén la serie si la técnica se degrada claramente.',
    mediaPath: null,
    mediaType: null,
  },
  {
    id: 'ex-breathing-reset',
    name: 'Respiración y movilidad suave',
    primaryMuscle: 'Recuperación',
    secondaryMuscles: [],
    equipment: 'Suelo',
    exerciseType: 'mobility',
    spineLoad: 'low',
    techniqueNotes: 'Respira de forma relajada y utiliza movimientos suaves, sin buscar intensidad.',
    mediaPath: null,
    mediaType: null,
  },
]

const templateDefinitions: Array<
  Omit<WorkoutTemplate, 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>
> = [
  {
    id: 'workout-upper-a',
    name: 'Upper A',
    dayOfWeek: 1,
    type: 'upper',
    description: 'Torso A · hipertrofia con empuje y tirón equilibrados.',
    estimatedDurationMinutes: 65,
    isFormalStrength: true,
  },
  {
    id: 'workout-lower-a',
    name: 'Lower A',
    dayOfWeek: 2,
    type: 'lower',
    description: 'Pierna A · énfasis en cuádriceps con trabajo posterior complementario.',
    estimatedDurationMinutes: 60,
    isFormalStrength: true,
  },
  {
    id: 'workout-upper-b',
    name: 'Upper B',
    dayOfWeek: 4,
    type: 'upper',
    description: 'Torso B · segunda exposición semanal de empuje y tirón.',
    estimatedDurationMinutes: 60,
    isFormalStrength: true,
  },
  {
    id: 'workout-lower-b',
    name: 'Lower B',
    dayOfWeek: 5,
    type: 'lower',
    description: 'Pierna B · cuádriceps, femoral, glúteo y gemelo sin RDL obligatorio.',
    estimatedDurationMinutes: 60,
    isFormalStrength: true,
  },
  {
    id: 'workout-mobility-daily',
    name: 'Movilidad diaria',
    dayOfWeek: null,
    type: 'mobility',
    description: 'Rutina breve de movilidad · objetivo 5–8 min, máximo aproximado 10 min.',
    estimatedDurationMinutes: 8,
    isFormalStrength: false,
  },
  {
    id: 'workout-recovery-weekly',
    name: 'Recovery semanal',
    dayOfWeek: 3,
    type: 'recovery',
    description: 'Sesión de baja fatiga para el miércoles · aproximadamente 15–20 min.',
    estimatedDurationMinutes: 18,
    isFormalStrength: false,
  },
]

interface ProgramConfig {
  id: string
  workoutTemplateId: string
  exerciseId: string
  order: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRirMin: number | null
  targetRirMax: number | null
  restSeconds: number
  alternativeExerciseIds?: string[]
  targetSeconds?: number | null
}

const programConfigs: ProgramConfig[] = [
  { id: 'vnext-uta-01', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-incline-dumbbell-press', order: 1, targetSets: 3, minReps: 6, maxReps: 10, targetRirMin: 2, targetRirMax: 2, restSeconds: 180 },
  { id: 'vnext-uta-02', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-lat-pulldown', order: 2, targetSets: 3, minReps: 8, maxReps: 12, targetRirMin: 2, targetRirMax: 2, restSeconds: 120, alternativeExerciseIds: ['ex-pull-up'] },
  { id: 'vnext-uta-03', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-chest-supported-row', order: 3, targetSets: 2, minReps: 8, maxReps: 12, targetRirMin: 2, targetRirMax: 2, restSeconds: 120, alternativeExerciseIds: ['ex-chest-supported-tbar-row', 'ex-seated-cable-row'] },
  { id: 'vnext-uta-04', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-cable-fly', order: 4, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },
  { id: 'vnext-uta-05', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-lateral-raise', order: 5, targetSets: 3, minReps: 12, maxReps: 20, targetRirMin: 1, targetRirMax: 2, restSeconds: 75 },
  { id: 'vnext-uta-06', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-bayesian-curl', order: 6, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },
  { id: 'vnext-uta-07', workoutTemplateId: 'workout-upper-a', exerciseId: 'ex-triceps-pushdown', order: 7, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },

  { id: 'vnext-lta-01', workoutTemplateId: 'workout-lower-a', exerciseId: 'ex-hack-squat', order: 1, targetSets: 3, minReps: 6, maxReps: 10, targetRirMin: 2, targetRirMax: 3, restSeconds: 180 },
  { id: 'vnext-lta-02', workoutTemplateId: 'workout-lower-a', exerciseId: 'ex-leg-press', order: 2, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 2, targetRirMax: 2, restSeconds: 120 },
  { id: 'vnext-lta-03', workoutTemplateId: 'workout-lower-a', exerciseId: 'ex-leg-curl', order: 3, targetSets: 3, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 105 },
  { id: 'vnext-lta-04', workoutTemplateId: 'workout-lower-a', exerciseId: 'ex-hip-thrust', order: 4, targetSets: 2, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120 },
  { id: 'vnext-lta-05', workoutTemplateId: 'workout-lower-a', exerciseId: 'ex-seated-calf-raise', order: 5, targetSets: 3, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, alternativeExerciseIds: ['ex-standing-calf-raise'] },

  { id: 'vnext-utb-01', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-bench-press', order: 1, targetSets: 3, minReps: 6, maxReps: 10, targetRirMin: 2, targetRirMax: 2, restSeconds: 180 },
  { id: 'vnext-utb-02', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-pull-up', order: 2, targetSets: 3, minReps: 6, maxReps: 10, targetRirMin: 2, targetRirMax: 2, restSeconds: 150, alternativeExerciseIds: ['ex-lat-pulldown'] },
  { id: 'vnext-utb-03', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-chest-supported-row', order: 3, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 2, targetRirMax: 2, restSeconds: 120, alternativeExerciseIds: ['ex-chest-supported-tbar-row', 'ex-seated-cable-row'] },
  { id: 'vnext-utb-04', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-lateral-raise', order: 4, targetSets: 3, minReps: 12, maxReps: 20, targetRirMin: 1, targetRirMax: 2, restSeconds: 75 },
  { id: 'vnext-utb-05', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-hammer-curl', order: 5, targetSets: 2, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },
  { id: 'vnext-utb-06', workoutTemplateId: 'workout-upper-b', exerciseId: 'ex-overhead-triceps-extension', order: 6, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },

  { id: 'vnext-ltb-01', workoutTemplateId: 'workout-lower-b', exerciseId: 'ex-leg-press', order: 1, targetSets: 3, minReps: 8, maxReps: 12, targetRirMin: 2, targetRirMax: 2, restSeconds: 150 },
  { id: 'vnext-ltb-02', workoutTemplateId: 'workout-lower-b', exerciseId: 'ex-leg-extension', order: 2, targetSets: 3, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 },
  { id: 'vnext-ltb-03', workoutTemplateId: 'workout-lower-b', exerciseId: 'ex-leg-curl', order: 3, targetSets: 3, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 105 },
  { id: 'vnext-ltb-04', workoutTemplateId: 'workout-lower-b', exerciseId: 'ex-hip-thrust', order: 4, targetSets: 2, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 120 },
  { id: 'vnext-ltb-05', workoutTemplateId: 'workout-lower-b', exerciseId: 'ex-seated-calf-raise', order: 5, targetSets: 3, minReps: 10, maxReps: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, alternativeExerciseIds: ['ex-standing-calf-raise'] },

  { id: 'vnext-mob-01', workoutTemplateId: 'workout-mobility-daily', exerciseId: 'ex-cat-cow', order: 1, targetSets: 1, minReps: 6, maxReps: 8, targetRirMin: null, targetRirMax: null, restSeconds: 0 },
  { id: 'vnext-mob-02', workoutTemplateId: 'workout-mobility-daily', exerciseId: 'ex-open-book', order: 2, targetSets: 1, minReps: 6, maxReps: 6, targetRirMin: null, targetRirMax: null, restSeconds: 0 },
  { id: 'vnext-mob-03', workoutTemplateId: 'workout-mobility-daily', exerciseId: 'ex-90-90-hip-switch', order: 3, targetSets: 1, minReps: 6, maxReps: 8, targetRirMin: null, targetRirMax: null, restSeconds: 0 },
  { id: 'vnext-mob-04', workoutTemplateId: 'workout-mobility-daily', exerciseId: 'ex-hip-flexor-stretch', order: 4, targetSets: 1, minReps: 1, maxReps: 1, targetRirMin: null, targetRirMax: null, restSeconds: 0, targetSeconds: 30 },
  { id: 'vnext-mob-05', workoutTemplateId: 'workout-mobility-daily', exerciseId: 'ex-wall-slides', order: 5, targetSets: 1, minReps: 8, maxReps: 10, targetRirMin: null, targetRirMax: null, restSeconds: 0 },

  { id: 'vnext-rec-01', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-bird-dog', order: 1, targetSets: 2, minReps: 6, maxReps: 8, targetRirMin: null, targetRirMax: null, restSeconds: 30 },
  { id: 'vnext-rec-02', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-dead-bug', order: 2, targetSets: 2, minReps: 6, maxReps: 8, targetRirMin: null, targetRirMax: null, restSeconds: 30 },
  { id: 'vnext-rec-03', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-side-plank', order: 3, targetSets: 2, minReps: 1, maxReps: 1, targetRirMin: null, targetRirMax: null, restSeconds: 30, targetSeconds: 25 },
  { id: 'vnext-rec-04', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-open-book', order: 4, targetSets: 1, minReps: 6, maxReps: 6, targetRirMin: null, targetRirMax: null, restSeconds: 0 },
  { id: 'vnext-rec-05', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-90-90-hip-switch', order: 5, targetSets: 1, minReps: 6, maxReps: 8, targetRirMin: null, targetRirMax: null, restSeconds: 0 },
  { id: 'vnext-rec-06', workoutTemplateId: 'workout-recovery-weekly', exerciseId: 'ex-breathing-reset', order: 6, targetSets: 1, minReps: 1, maxReps: 1, targetRirMin: null, targetRirMax: null, restSeconds: 0, targetSeconds: 150 },
]

async function upsertExercises() {
  for (const definition of exerciseDefinitions) {
    const current = await db.exercises.get(definition.id)

    if (!current) {
      await db.exercises.add({
        ...entityBase(definition.id),
        ...definition,
      })
      continue
    }

    await db.exercises.update(current.id, {
      name: definition.name,
      primaryMuscle: definition.primaryMuscle,
      secondaryMuscles: definition.secondaryMuscles,
      equipment: definition.equipment,
      exerciseType: definition.exerciseType,
      techniqueNotes: definition.techniqueNotes,
      deletedAt: null,
      updatedAt: nowIso(),
      version: current.version + 1,
    })
  }
}

async function upsertTemplates() {
  for (const definition of templateDefinitions) {
    const current = await db.workoutTemplates.get(definition.id)

    if (!current) {
      await db.workoutTemplates.add({
        ...entityBase(definition.id),
        ...definition,
      })
      continue
    }

    await db.workoutTemplates.update(current.id, {
      name: definition.name,
      dayOfWeek: definition.dayOfWeek,
      type: definition.type,
      description: definition.description,
      estimatedDurationMinutes: definition.estimatedDurationMinutes,
      isFormalStrength: definition.isFormalStrength,
      deletedAt: null,
      updatedAt: nowIso(),
      version: current.version + 1,
    })
  }
}

async function applyApprovedProgram() {
  const meta = await db.appMeta.get(PROGRAM_MIGRATION_KEY)

  if (meta?.value === PROGRAM_VERSION) {
    return
  }

  await preserveLegacySessionsBeforeProgramChange()

  await db.transaction(
    'rw',
    db.appMeta,
    db.exercises,
    db.workoutTemplates,
    db.workoutTemplateExercises,
    async () => {
      await upsertExercises()
      await upsertTemplates()

      const formalTemplateIds = new Set([
        'workout-upper-a',
        'workout-lower-a',
        'workout-upper-b',
        'workout-lower-b',
        'workout-mobility-daily',
        'workout-recovery-weekly',
      ])

      const existingConfigs = await db.workoutTemplateExercises.toArray()
      const approvedIds = new Set(programConfigs.map((item) => item.id))
      const referenceByTemplateAndExercise = new Map<string, number | null>()

      for (const config of existingConfigs) {
        if (config.deletedAt === null) {
          referenceByTemplateAndExercise.set(
            `${config.workoutTemplateId}:${config.exerciseId}`,
            config.referenceWeight,
          )
        }
      }

      for (const config of existingConfigs) {
        if (
          config.deletedAt === null &&
          formalTemplateIds.has(config.workoutTemplateId) &&
          !approvedIds.has(config.id)
        ) {
          await db.workoutTemplateExercises.update(config.id, {
            deletedAt: nowIso(),
            updatedAt: nowIso(),
            version: config.version + 1,
          })
        }
      }

      for (const definition of programConfigs) {
        const current = await db.workoutTemplateExercises.get(definition.id)
        const referenceWeight =
          current?.referenceWeight ??
          referenceByTemplateAndExercise.get(
            `${definition.workoutTemplateId}:${definition.exerciseId}`,
          ) ??
          null

        const next = {
          workoutTemplateId: definition.workoutTemplateId,
          exerciseId: definition.exerciseId,
          order: definition.order,
          targetSets: definition.targetSets,
          minReps: definition.minReps,
          maxReps: definition.maxReps,
          targetRir: definition.targetRirMin,
          targetRirMin: definition.targetRirMin,
          targetRirMax: definition.targetRirMax,
          restSeconds: definition.restSeconds,
          referenceWeight,
          alternativeExerciseIds: definition.alternativeExerciseIds ?? [],
          supersetGroupId: null,
          targetSeconds: definition.targetSeconds ?? null,
          deletedAt: null,
          updatedAt: nowIso(),
        }

        if (current) {
          await db.workoutTemplateExercises.update(current.id, {
            ...next,
            version: current.version + 1,
          })
        } else {
          await db.workoutTemplateExercises.add({
            ...entityBase(definition.id),
            ...next,
          })
        }
      }

      await db.appMeta.put({
        key: PROGRAM_MIGRATION_KEY,
        value: PROGRAM_VERSION,
        updatedAt: nowIso(),
      })
    },
  )
}

async function ensurePlanningWindow() {
  let planningStart = await db.appMeta.get(PLANNING_START_KEY)

  if (!planningStart) {
    planningStart = {
      key: PLANNING_START_KEY,
      value: getLocalDateKey(),
      updatedAt: nowIso(),
    }

    await db.appMeta.put(planningStart)
  }

  const today = getLocalDateKey()
  const start = planningStart.value > today ? planningStart.value : today
  const end = shiftDateKey(today, 42)

  const templates = (await db.workoutTemplates.toArray())
    .filter(
      (template) =>
        template.deletedAt === null &&
        template.isFormalStrength === true &&
        template.dayOfWeek !== null,
    )

  const existing = (await db.plannedWorkoutSessions.toArray())
    .filter((session) => session.deletedAt === null)

  const keys = new Set(
    existing.map(
      (session) =>
        `${session.workoutTemplateId}:${session.originalScheduledDate}`,
    ),
  )

  const additions = []

  for (let cursor = start; cursor <= end; cursor = shiftDateKey(cursor, 1)) {
    const weekday = parseDateKey(cursor).getDay()

    for (const template of templates) {
      if (template.dayOfWeek !== weekday) {
        continue
      }

      const key = `${template.id}:${cursor}`

      if (keys.has(key)) {
        continue
      }

      additions.push({
        ...entityBase(createUuid()),
        workoutTemplateId: template.id,
        templateName: template.name,
        originalScheduledDate: cursor,
        scheduledDate: cursor,
        status: 'pending' as const,
        executionSessionId: null,
        isFormalStrength: true,
        isExtra: false,
        estimatedDurationMinutes: template.estimatedDurationMinutes ?? null,
        rescheduleCount: 0,
        resolvedAt: null,
        notes: null,
      })

      keys.add(key)
    }
  }

  if (additions.length > 0) {
    await db.plannedWorkoutSessions.bulkAdd(additions)
  }
}

export async function ensureTrainingSeed() {
  await applyApprovedProgram()
  await ensurePlanningWindow()
}
