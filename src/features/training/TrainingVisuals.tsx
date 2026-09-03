import type { Exercise } from '../../types/training'
import type { TrainingTemplateView } from './trainingService'

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

function Zone({
  zone,
  active,
  d,
}: {
  zone: MuscleZone
  active: Set<MuscleZone>
  d: string
}) {
  return <path className={active.has(zone) ? 'anatomy-zone is-active' : 'anatomy-zone'} d={d} />
}

function AnatomyFigure({
  active,
  back = false,
}: {
  active: Set<MuscleZone>
  back?: boolean
}) {
  return (
    <svg viewBox="0 0 94 178" aria-hidden="true">
      <circle className="anatomy-base" cx="47" cy="15" r="10" />
      <path className="anatomy-base" d="M36 28c-8 5-11 15-11 29l4 35 6 24 3 49h9l1-48h-2V90h2v27l1 48h9l3-49 6-24 4-35c0-14-3-24-11-29l-8-4H44l-8 4Z" />
      {!back ? (
        <>
          <Zone zone="shoulders" active={active} d="M35 31 24 41l4 17 12-8-1-17Zm24 0 11 10-4 17-12-8 1-17Z" />
          <Zone zone="chest" active={active} d="M39 34h16l5 17-13 8-13-8 5-17Z" />
          <Zone zone="arms" active={active} d="M25 45 19 70l6 22 7-2-3-25 5-20Zm44 0 6 25-6 22-7-2 3-25-5-20Z" />
          <Zone zone="core" active={active} d="M40 56h14l4 31-11 9-11-9 4-31Z" />
          <Zone zone="quads" active={active} d="M35 95 39 117l2 42h7l-1-42-1-22Zm24 0-4 22-2 42h-7l1-42 1-22Z" />
          <Zone zone="calves" active={active} d="M38 122 39 165h8l-1-43Zm18 0-1 43h-8l1-43Z" />
        </>
      ) : (
        <>
          <Zone zone="shoulders" active={active} d="M35 31 24 41l4 17 12-8-1-17Zm24 0 11 10-4 17-12-8 1-17Z" />
          <Zone zone="back" active={active} d="M38 34h18l8 19-6 31-11 8-11-8-6-31 8-19Z" />
          <Zone zone="arms" active={active} d="M25 45 19 70l6 22 7-2-3-25 5-20Zm44 0 6 25-6 22-7-2 3-25-5-20Z" />
          <Zone zone="glutes" active={active} d="M35 88c2 12 6 18 12 18s10-6 12-18l-12-5-12 5Z" />
          <Zone zone="hamstrings" active={active} d="M35 103 39 124l2 35h7l-1-42-1-14Zm24 0-4 21-2 35h-7l1-42 1-14Z" />
          <Zone zone="calves" active={active} d="M38 127 39 165h8l-1-38Zm18 0-1 38h-8l1-38Z" />
        </>
      )}
    </svg>
  )
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

type MotionKind =
  | 'press'
  | 'fly'
  | 'pull'
  | 'row'
  | 'raise'
  | 'curl'
  | 'triceps'
  | 'squat'
  | 'leg-extension'
  | 'leg-curl'
  | 'hip-thrust'
  | 'calf'
  | 'cat-cow'
  | 'open-book'
  | 'hip-switch'
  | 'hip-flexor'
  | 'wall-slide'
  | 'bird-dog'
  | 'dead-bug'
  | 'side-plank'
  | 'breathing'
  | 'generic'

function motionKind(exercise: Exercise): MotionKind {
  const id = exercise.id

  if (id.includes('cat-cow')) return 'cat-cow'
  if (id.includes('open-book')) return 'open-book'
  if (id.includes('90-90')) return 'hip-switch'
  if (id.includes('hip-flexor')) return 'hip-flexor'
  if (id.includes('wall-slide')) return 'wall-slide'
  if (id.includes('bird-dog')) return 'bird-dog'
  if (id.includes('dead-bug')) return 'dead-bug'
  if (id.includes('side-plank')) return 'side-plank'
  if (id.includes('breathing')) return 'breathing'
  if (id.includes('bench') || id.includes('incline-dumbbell-press')) return 'press'
  if (id.includes('fly')) return 'fly'
  if (id.includes('pulldown') || id.includes('pull-up')) return 'pull'
  if (id.includes('row')) return 'row'
  if (id.includes('lateral-raise')) return 'raise'
  if (id.includes('curl')) return 'curl'
  if (id.includes('triceps')) return 'triceps'
  if (id.includes('hack') || id.includes('leg-press')) return 'squat'
  if (id.includes('leg-extension')) return 'leg-extension'
  if (id.includes('leg-curl')) return 'leg-curl'
  if (id.includes('hip-thrust')) return 'hip-thrust'
  if (id.includes('calf')) return 'calf'

  return 'generic'
}

function MotionArtwork({ kind }: { kind: MotionKind }) {
  switch (kind) {
    case 'press':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M18 61h73M28 61l-6 13M82 61l6 13" />
          <circle className="motion-person" cx="45" cy="44" r="7" />
          <path className="motion-person" d="M50 48 66 54 81 50M65 54 73 64M58 51 49 62" />
          <g className="motion-moving motion-moving--press">
            <path className="motion-accent" d="M27 30h63M34 24v12M83 24v12" />
            <path className="motion-person" d="M57 47 46 32M69 52 76 32" />
          </g>
        </svg>
      )
    case 'fly':
      return (
        <svg viewBox="0 0 120 84">
          <circle className="motion-person" cx="60" cy="20" r="7" />
          <path className="motion-person" d="M60 27v31M60 58 46 76M60 58 74 76" />
          <g className="motion-moving motion-moving--fly">
            <path className="motion-accent" d="M60 36 28 50M60 36 92 50" />
            <circle className="motion-equipment" cx="26" cy="51" r="3" />
            <circle className="motion-equipment" cx="94" cy="51" r="3" />
          </g>
        </svg>
      )
    case 'pull':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M24 11h72M31 8v6M89 8v6" />
          <circle className="motion-person" cx="60" cy="31" r="7" />
          <path className="motion-person" d="M60 38v26M60 64 49 79M60 64 71 79" />
          <g className="motion-moving motion-moving--pull">
            <path className="motion-accent" d="M57 38 39 19M63 38 81 19" />
          </g>
        </svg>
      )
    case 'row':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M17 67h58M25 67l9-25h40" />
          <circle className="motion-person" cx="62" cy="31" r="7" />
          <path className="motion-person" d="M59 38 45 51 39 69M45 51 65 63M65 63 82 74" />
          <g className="motion-moving motion-moving--row">
            <path className="motion-accent" d="M52 45 82 49" />
            <circle className="motion-equipment" cx="87" cy="49" r="5" />
          </g>
        </svg>
      )
    case 'raise':
      return (
        <svg viewBox="0 0 120 84">
          <circle className="motion-person" cx="60" cy="17" r="7" />
          <path className="motion-person" d="M60 24v34M60 58 48 78M60 58 72 78" />
          <g className="motion-moving motion-moving--raise">
            <path className="motion-accent" d="M58 35 30 35M62 35 90 35" />
            <circle className="motion-equipment" cx="27" cy="35" r="4" />
            <circle className="motion-equipment" cx="93" cy="35" r="4" />
          </g>
        </svg>
      )
    case 'curl':
      return (
        <svg viewBox="0 0 120 84">
          <circle className="motion-person" cx="60" cy="16" r="7" />
          <path className="motion-person" d="M60 23v34M60 57 49 78M60 57 71 78M48 33l7 24M72 33l-7 24" />
          <g className="motion-moving motion-moving--curl">
            <path className="motion-accent" d="M55 56 44 43M65 56 76 43" />
            <circle className="motion-equipment" cx="42" cy="41" r="4" />
            <circle className="motion-equipment" cx="78" cy="41" r="4" />
          </g>
        </svg>
      )
    case 'triceps':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M60 6v18" />
          <circle className="motion-person" cx="60" cy="22" r="7" />
          <path className="motion-person" d="M60 29v31M60 60 48 79M60 60 72 79" />
          <g className="motion-moving motion-moving--triceps">
            <path className="motion-accent" d="M47 36 52 55M73 36 68 55" />
            <path className="motion-equipment" d="M43 34h34" />
          </g>
        </svg>
      )
    case 'squat':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M19 68h82M28 12v57M92 12v57M28 17h64" />
          <g className="motion-moving motion-moving--squat">
            <circle className="motion-person" cx="60" cy="28" r="7" />
            <path className="motion-person" d="M60 35v22M60 43 43 47M60 43 77 47M60 57 45 67M60 57 75 67" />
          </g>
        </svg>
      )
    case 'leg-extension':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M27 58h40M31 58v20M67 58v20" />
          <circle className="motion-person" cx="55" cy="27" r="7" />
          <path className="motion-person" d="M55 34 50 54 67 59" />
          <g className="motion-moving motion-moving--leg-extension">
            <path className="motion-accent" d="M67 59 93 59" />
            <circle className="motion-equipment" cx="96" cy="59" r="5" />
          </g>
        </svg>
      )
    case 'leg-curl':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M20 56h70M25 56v17M85 56v17" />
          <circle className="motion-person" cx="35" cy="39" r="6" />
          <path className="motion-person" d="M41 41 64 52" />
          <g className="motion-moving motion-moving--leg-curl">
            <path className="motion-accent" d="M64 52 86 41" />
            <circle className="motion-equipment" cx="90" cy="39" r="5" />
          </g>
        </svg>
      )
    case 'hip-thrust':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M17 54h30M20 54v20" />
          <circle className="motion-person" cx="43" cy="39" r="6" />
          <g className="motion-moving motion-moving--hip">
            <path className="motion-person" d="M48 42 68 47 85 66M68 47 54 68" />
            <path className="motion-accent" d="M53 45h30" />
          </g>
        </svg>
      )
    case 'calf':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M30 73h60" />
          <g className="motion-moving motion-moving--calf">
            <circle className="motion-person" cx="60" cy="17" r="7" />
            <path className="motion-person" d="M60 24v32M60 56 48 73M60 56 72 73M47 72h12M61 72h12" />
          </g>
        </svg>
      )
    case 'cat-cow':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M18 70h84" />
          <g className="motion-moving motion-moving--catcow">
            <circle className="motion-person" cx="35" cy="43" r="6" />
            <path className="motion-accent" d="M41 44Q60 28 80 45" />
            <path className="motion-person" d="M45 45 38 67M75 45 82 67" />
          </g>
        </svg>
      )
    case 'open-book':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M15 70h90" />
          <circle className="motion-person" cx="45" cy="48" r="6" />
          <path className="motion-person" d="M51 50 69 56M69 56 85 67M66 56 50 69" />
          <g className="motion-moving motion-moving--openbook">
            <path className="motion-accent" d="M56 52 72 30 91 24" />
          </g>
        </svg>
      )
    case 'hip-switch':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M16 71h88" />
          <circle className="motion-person" cx="60" cy="29" r="7" />
          <path className="motion-person" d="M60 36v20" />
          <g className="motion-moving motion-moving--hipswitch">
            <path className="motion-accent" d="M60 55 38 65M60 55 82 65M38 65 28 54M82 65 92 54" />
          </g>
        </svg>
      )
    case 'hip-flexor':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M15 72h90" />
          <circle className="motion-person" cx="55" cy="21" r="7" />
          <path className="motion-person" d="M55 28v24" />
          <g className="motion-moving motion-moving--hipflexor">
            <path className="motion-accent" d="M55 52 38 70M55 52 78 58 91 70" />
          </g>
        </svg>
      )
    case 'wall-slide':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M91 8v69" />
          <circle className="motion-person" cx="70" cy="22" r="7" />
          <path className="motion-person" d="M70 29v32M70 61 59 78M70 61 81 78" />
          <g className="motion-moving motion-moving--wallslide">
            <path className="motion-accent" d="M68 38 55 23M72 38 85 23" />
          </g>
        </svg>
      )
    case 'bird-dog':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M15 70h90" />
          <circle className="motion-person" cx="44" cy="43" r="6" />
          <path className="motion-person" d="M50 45 70 52M52 48 41 68M68 52 61 69" />
          <g className="motion-moving motion-moving--birddog">
            <path className="motion-accent" d="M50 45 25 35M70 52 96 39" />
          </g>
        </svg>
      )
    case 'dead-bug':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M15 70h90" />
          <circle className="motion-person" cx="55" cy="52" r="6" />
          <path className="motion-person" d="M61 53 76 59" />
          <g className="motion-moving motion-moving--deadbug">
            <path className="motion-accent" d="M54 48 38 28M76 59 95 38M59 50 75 30M52 57 33 66" />
          </g>
        </svg>
      )
    case 'side-plank':
      return (
        <svg viewBox="0 0 120 84">
          <path className="motion-equipment" d="M15 72h90" />
          <g className="motion-moving motion-moving--sideplank">
            <circle className="motion-person" cx="37" cy="48" r="6" />
            <path className="motion-accent" d="M43 49 69 57 91 67M55 53 48 70" />
          </g>
        </svg>
      )
    case 'breathing':
      return (
        <svg viewBox="0 0 120 84">
          <circle className="motion-person" cx="60" cy="24" r="7" />
          <path className="motion-person" d="M60 31v31M60 62 48 78M60 62 72 78" />
          <g className="motion-moving motion-moving--breathing">
            <circle className="motion-accent motion-breath" cx="60" cy="45" r="13" />
          </g>
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 120 84">
          <circle className="motion-person" cx="60" cy="18" r="7" />
          <path className="motion-person" d="M60 25v34M60 59 48 79M60 59 72 79M60 38 42 50M60 38 78 50" />
          <circle className="motion-accent motion-pulse" cx="60" cy="43" r="28" />
        </svg>
      )
  }
}

export function ExerciseVisual({
  exercise,
  guided,
}: {
  exercise: Exercise
  guided: boolean
}) {
  const kind = motionKind(exercise)

  return (
    <div className="training-exercise-visual">
      <div className={`training-exercise-motion training-exercise-motion--${kind}`} aria-hidden="true">
        <MotionArtwork kind={kind} />
        <span>{guided ? 'MOV' : exercise.primaryMuscle.slice(0, 3).toUpperCase()}</span>
      </div>
      <ExerciseMuscleMap exercise={exercise} />
    </div>
  )
}
