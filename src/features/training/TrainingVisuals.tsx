import { LicensedExerciseMotion } from './media/LicensedExerciseMotion'
import { useId, useState } from 'react'
import type { Exercise } from '../../types/training'
import type { TrainingTemplateView } from './trainingService'
import { getExerciseMedia } from './media/exerciseMediaRegistry'

type MuscleZone =
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'back'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

function zonesForMuscle(value: string): MuscleZone[] {
  const muscle = normalize(value)

  if (muscle.includes('pecho') || muscle.includes('pectoral')) return ['chest']
  if (muscle.includes('hombro') || muscle.includes('deltoid')) return ['shoulders']
  if (muscle.includes('bicep') || muscle.includes('tricep') || muscle.includes('brazo') || muscle.includes('antebrazo')) return ['arms']
  if (muscle.includes('espalda') || muscle.includes('dorsal') || muscle.includes('trapec')) return ['back']
  if (muscle.includes('core') || muscle.includes('abd')) return ['core']
  if (muscle.includes('glute')) return ['glutes']
  if (muscle.includes('cuadricep')) return ['quads']
  if (muscle.includes('isquio') || muscle.includes('femoral')) return ['hamstrings']
  if (muscle.includes('gemelo') || muscle.includes('pantorr')) return ['calves']
  if (muscle.includes('cadera')) return ['glutes', 'core']

  return []
}

function activeZones(muscles: string[]) {
  return new Set(muscles.flatMap(zonesForMuscle))
}

/** Decorative anatomical map; dynamic highlights consume the exercise's existing muscle facts. */
function AnatomyFigure({ active, back = false }: { active: Set<MuscleZone>; back?: boolean }) {
  const id = useId().replace(/:/g, '')
  const zones: Array<[MuscleZone, string]> = [
    ['shoulders', 'M37 44Q25 45 23 57L24 66Q33 66 39 57ZM83 44Q95 45 97 57L96 66Q87 66 81 57Z'],
    ['arms', 'M25 65Q20 68 20 78L23 91Q31 86 34 73L35 63ZM95 65Q100 68 100 78L97 91Q89 86 86 73L85 63Z'],
    ['arms', 'M23 92Q17 105 16 119L22 121Q29 111 30 95ZM97 92Q103 105 104 119L98 121Q91 111 90 95Z'],
    ...(back ? [
      ['back', 'M48 40 41 43 43 64 58 73 59 48ZM72 40 79 43 77 64 62 73 61 48Z'],
      ['back', 'M39 64Q37 84 44 103L58 112 58 77ZM81 64Q83 84 76 103L62 112 62 77Z'],
      ['back', 'M49 97 47 113 59 123 59 100ZM71 97 73 113 61 123 61 100Z'],
      ['glutes', 'M45 117Q36 128 38 145 51 153 59 142L59 123ZM75 117Q84 128 82 145 69 153 61 142L61 123Z'],
      ['hamstrings', 'M38 150Q36 165 39 186L49 191Q54 169 57 150ZM82 150Q84 165 81 186L71 191Q66 169 63 150Z'],
      ['hamstrings', 'M50 150 48 180 53 188 58 161ZM70 150 72 180 67 188 62 161Z'],
    ] as Array<[MuscleZone,string]> : [
      ['chest', 'M40 48Q48 43 58 48L58 69Q43 72 36 61ZM80 48Q72 43 62 48L62 69Q77 72 84 61Z'],
      ['core', 'M47 74Q52 70 58 74V82H48ZM73 74Q68 70 62 74V82H72Z'],
      ['core', 'M49 84H58V93H50ZM71 84H62V93H70Z'],
      ['core', 'M50 95H58V105H51ZM70 95H62V105H69Z'],
      ['core', 'M51 108H58V120L54 117ZM69 108H62V120L66 117Z'],
      ['core', 'M38 74 47 84 49 112 43 106ZM82 74 73 84 71 112 77 106Z'],
      ['quads', 'M41 129Q33 147 38 168L44 185Q53 166 52 147L48 128ZM79 129Q87 147 82 168L76 185Q67 166 68 147L72 128Z'],
      ['quads', 'M54 130Q61 137 58 160L52 179 47 183Q55 156 54 130ZM66 130Q59 137 62 160L68 179 73 183Q65 156 66 130Z'],
      ['quads', 'M43 173Q44 189 50 188L53 174 49 161ZM77 173Q76 189 70 188L67 174 71 161Z'],
    ] as Array<[MuscleZone,string]>),
    ['calves', back ? 'M40 195Q31 212 41 226L47 229Q53 211 49 196ZM80 195Q89 212 79 226L73 229Q67 211 71 196Z' : 'M40 195Q37 214 43 231L47 231 49 196ZM80 195Q83 214 77 231L73 231 71 196Z'],
  ]
  return <svg viewBox="0 0 120 260" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" x2="1"><stop stopColor="#141719"/><stop offset=".4" stopColor="#424649"/><stop offset=".65" stopColor="#2b2e30"/><stop offset="1" stopColor="#101315"/></linearGradient>
      <radialGradient id={`${id}-muscle`} cx="40%" cy="28%" r="75%"><stop stopColor="#414548"/><stop offset=".55" stopColor="#292d2f"/><stop offset="1" stopColor="#101315"/></radialGradient>
      <radialGradient id={`${id}-active`} cx="35%" cy="25%" r="75%"><stop stopColor="#ff4b4e"/><stop offset=".5" stopColor="#f20c1a"/><stop offset="1" stopColor="#8c020b"/></radialGradient>
    </defs>
    <g fill={`url(#${id}-body)`} stroke="#44484a" strokeWidth=".7">
      <path d="M51 30 49 39Q31 39 24 48 18 61 20 81L15 111 13 125 16 135 19 130 20 135 23 129 24 121 32 104 35 84 42 106 40 120Q32 141 36 166L39 189 36 214 39 240 35 249 43 252 50 250 50 239 52 218 51 190 58 159 60 142 62 159 69 190 68 218 70 239 70 250 77 252 85 249 81 240 84 214 81 189 84 166Q88 141 80 120L78 106 85 84 88 104 96 121 97 129 100 135 101 130 104 135 107 125 105 111 100 81Q102 61 96 48 89 39 71 39L69 30Z"/>
      <path d="M50 8Q60 2 70 8L72 21 68 32 62 36H58L52 32 48 21Z"/>
      <path d="m51 23 6 3m12-3-6 3m-6 4h6M59 14l-2 9h5M49 13q11-7 22 0" fill="none" stroke="#151819"/>
      {zones.map(([zone,d],index) => <path key={index} d={d} fill={`url(#${id}-${active.has(zone) ? 'active' : 'muscle'})`} stroke={active.has(zone) ? '#63040a' : '#141719'} strokeWidth=".75" />)}
      <path d="M60 39v83M42 191q4 5 8 0m20 0q4 5 8 0M43 230l-1 12m35-12 1 12M24 75l4 4m68-4-4 4M41 117l12 8m26-8-12 8" fill="none" stroke="#101214"/>
      <path d="m51 37 5 9m13-9-5 9M39 53l1 10m41-10-1 10M21 114l-2 11m82-11 2 11" fill="none" stroke="#5d6265" opacity=".45"/>
    </g>
  </svg>
}

export function RoutineMuscleMap({
  template,
  compact = false,
}: {
  template: TrainingTemplateView | null
  compact?: boolean
}) {
  const muscleCounts = new Map<string, number>()

  for (const item of template?.exercises ?? []) {
    const values = [item.exercise.primaryMuscle, ...item.exercise.secondaryMuscles]
    values.forEach((muscle, index) => {
      muscleCounts.set(
        muscle,
        (muscleCounts.get(muscle) ?? 0) + item.config.targetSets * (index === 0 ? 1 : 0.35),
      )
    })
  }

  const muscles = [...muscleCounts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([muscle]) => muscle)

  const active = activeZones(muscles)

  return (
    <div className={compact ? 'training-anatomy training-anatomy--compact' : 'training-anatomy'}>
      <div className="training-anatomy__figures" aria-hidden="true">
        <AnatomyFigure active={active} />
        <AnatomyFigure active={active} back />
      </div>
      {!compact && (
        <div className="training-anatomy__copy">
          <span>MÚSCULOS HOY</span>
          <strong>{muscles.slice(0, 5).join(' · ') || 'Movilidad / recuperación'}</strong>
          <small>Mapa funcional de la sesión.</small>
        </div>
      )}
    </div>
  )
}

export function ExerciseMuscleMap({ exercise }: { exercise: Exercise }) {
  const muscles = [exercise.primaryMuscle, ...exercise.secondaryMuscles]
  const active = activeZones(muscles)

  return (
    <div className="training-exercise-anatomy" aria-label={`Músculos: ${muscles.join(', ')}`}>
      <AnatomyFigure active={active} />
    </div>
  )
}

export function ExerciseVisual({
  exercise,
  guided,
  interactive = false,
}: {
  exercise: Exercise
  guided: boolean
  interactive?: boolean
}) {
  const definition = getExerciseMedia(exercise.id)
  const [motion, setMotion] = useState(guided)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="training-exercise-visual training-exercise-visual--v21" data-exercise-id={exercise.id}>
      <div className="training-exercise-visual__media">
        {definition && !motion && !failed ? (
          <picture>
            <img
              src={definition.staticAsset}
              alt={`Ilustración de ${exercise.name}`}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const candidates = [definition.staticAsset, ...(definition.fallbackAssets ?? (definition.fallbackAsset ? [definition.fallbackAsset] : []))]
                const current = candidates.findIndex(path => event.currentTarget.src.endsWith(path))
                if (current >= 0 && candidates[current + 1]) {
                  event.currentTarget.src = candidates[current + 1]
                } else {
                  setFailed(true)
                }
              }}
            />
          </picture>
        ) : null}
        {motion || !definition || failed ? <LicensedExerciseMotion key={exercise.id} exercise={exercise} paused={paused || !motion} /> : null}
        {definition?.source === 'user-licensed' ? <small className="training-exercise-visual__credit">Gymvisual</small> : definition?.source === 'repdb' ? (
          <small className="training-exercise-visual__credit">RepDB</small>
        ) : definition ? (
          <small className="training-exercise-visual__credit">FÉNIX</small>
        ) : null}
      </div>
      {interactive ? <div className="training-motion-controls">
        <button type="button" onClick={() => { setMotion(!motion); setPaused(false) }}>{motion ? 'Ver imagen' : 'Ver movimiento'}</button>
        {motion ? <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Reanudar movimiento' : 'Pausar movimiento'}</button> : null}
      </div> : null}
      <ExerciseMuscleMap exercise={exercise} />
    </div>
  )
}
