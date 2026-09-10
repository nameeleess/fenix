import { useEffect, useRef } from 'react'
import type { Exercise } from '../../../types/training'
import { EXERCISE_MOTION_SCENES, type Point, type Pose } from './exerciseMotionScenes'
import './exercise-motion.css'

const segments = [[1,2],[1,3,4],[1,5,6],[2,7,8],[2,9,10]] as const
const points = (pose: Pose, indices: readonly number[]) => indices.map(index => pose[index].join(',')).join(' ')
const midpoint = (a: Point,b: Point): Point => [(a[0]+b[0])/2,(a[1]+b[1])/2]

export function ExerciseMotion({ exercise, paused = false }: { exercise: Exercise; paused?: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const scene = EXERCISE_MOTION_SCENES[exercise.id]
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      if (paused || reduced.matches) svg.current?.pauseAnimations()
      else svg.current?.unpauseAnimations()
    }
    update()
    reduced.addEventListener('change',update)
    return () => reduced.removeEventListener('change',update)
  },[paused,exercise.id])
  if (!scene) return <div className="exercise-motion-unavailable">Demostración no disponible para este ejercicio.</div>
  const cycle = (start: string | number,end: string | number) => `${start};${end};${end};${start};${start}`
  const animation = { dur:'4s', repeatCount:'indefinite', keyTimes:'0;0.4;0.5;0.9;1' }
  const cableTarget = (pose: Pose) => scene.load === 'bar' || scene.load === 'rope' ? midpoint(pose[4], pose[6]) : pose[4]
  return <figure className="exercise-motion-scene" data-motion-id={`motion-${exercise.id}`} data-orientation={scene.orientation} data-equipment={scene.equipment}>
    <svg ref={svg} viewBox="0 0 240 170" role="img" aria-label={`Movimiento de ${exercise.name}: ${scene.trajectory}`}>
      <path className="exercise-motion-apparatus" d={scene.apparatus}/>
      {scene.cableAnchor && <line className={exercise.id === 'ex-chest-supported-tbar-row' ? 'exercise-motion-apparatus' : 'exercise-motion-cable'} x1={scene.cableAnchor[0]} y1={scene.cableAnchor[1]} x2={cableTarget(scene.start)[0]} y2={cableTarget(scene.start)[1]}>
        <animate attributeName="x2" values={cycle(cableTarget(scene.start)[0],cableTarget(scene.end)[0])} {...animation}/><animate attributeName="y2" values={cycle(cableTarget(scene.start)[1],cableTarget(scene.end)[1])} {...animation}/>
      </line>}
      {exercise.id === 'ex-cat-cow' ? <path className="exercise-motion-body exercise-motion-body--0" d="M87 80 Q122 52 158 80"><animate attributeName="d" values={cycle('M87 80 Q122 52 158 80','M87 89 Q122 112 158 82')} {...animation}/></path> : null}
      {segments.map((indices,i) => exercise.id === 'ex-cat-cow' && i === 0 ? null : <polyline key={i} className={`exercise-motion-body exercise-motion-body--${i}`} points={points(scene.start,indices)}>
        <animate attributeName="points" values={cycle(points(scene.start,indices),points(scene.end,indices))} {...animation}/>
      </polyline>)}
      <circle className="exercise-motion-head" cx={scene.start[0][0]} cy={scene.start[0][1]} r="9">
        <animate attributeName="cx" values={cycle(scene.start[0][0],scene.end[0][0])} {...animation}/><animate attributeName="cy" values={cycle(scene.start[0][1],scene.end[0][1])} {...animation}/>
      </circle>
      {scene.load === 'dumbbells' ? [4,6].map(index => <g key={index} transform={`translate(${scene.start[index].join(' ')})`}>
        <animateTransform attributeName="transform" type="translate" values={cycle(scene.start[index].join(' '),scene.end[index].join(' '))} {...animation}/>
        <g transform={exercise.id === 'ex-hammer-curl' ? 'rotate(90)' : undefined}>
          <path className="exercise-motion-bar" d="M-7 0H7" />
          <path className="exercise-motion-bar" d="M-7 -5V5M7 -5V5" />
        </g>
      </g>) : null}
      {scene.load && scene.load !== 'dumbbells' && [4,6].map(index => <g key={index}>
        <circle className={`exercise-motion-load exercise-motion-load--${scene.load}`} cx={scene.start[index][0]} cy={scene.start[index][1]} r={scene.load==='dumbbells'?6:3}>
          <animate attributeName="cx" values={cycle(scene.start[index][0],scene.end[index][0])} {...animation}/><animate attributeName="cy" values={cycle(scene.start[index][1],scene.end[index][1])} {...animation}/>
        </circle>
      </g>)}
      {exercise.id === 'ex-ez-bar-curl' ? <path className="exercise-motion-bar" d="M86 106H96L108 101L120 109L132 101L144 106H154"><animate attributeName="d" values={cycle('M86 106H96L108 101L120 109L132 101L144 106H154','M96 49H106L112 44L120 52L128 44L134 49H144')} {...animation}/></path> : null}
      {scene.load==='bar' && exercise.id !== 'ex-ez-bar-curl' && <line className="exercise-motion-bar" x1={scene.start[4][0]-10} y1={scene.start[4][1]} x2={scene.start[6][0]+10} y2={scene.start[6][1]}>
        <animate attributeName="x1" values={cycle(scene.start[4][0]-10,scene.end[4][0]-10)} {...animation}/><animate attributeName="y1" values={cycle(scene.start[4][1],scene.end[4][1])} {...animation}/>
        <animate attributeName="x2" values={cycle(scene.start[6][0]+10,scene.end[6][0]+10)} {...animation}/><animate attributeName="y2" values={cycle(scene.start[6][1],scene.end[6][1])} {...animation}/>
      </line>}
      {exercise.id === 'ex-seated-calf-raise' || exercise.id === 'ex-standing-calf-raise' ? [8,10].map(joint => <line key={joint} className="exercise-motion-body" x1={scene.start[joint][0]} y1={scene.start[joint][1]} x2={scene.start[joint][0]+15} y2={scene.start[joint][1]+3}>
        <animate attributeName="x1" values={cycle(scene.start[joint][0],scene.end[joint][0])} {...animation}/><animate attributeName="y1" values={cycle(scene.start[joint][1],scene.end[joint][1])} {...animation}/>
      </line>) : null}
      {exercise.id === 'ex-cable-fly' ? [4, 6].map((joint, index) => <line key={joint} className="exercise-motion-cable" x1={index === 0 ? 20 : 220} y1="57" x2={scene.start[joint][0]} y2={scene.start[joint][1]}><animate attributeName="x2" values={cycle(scene.start[joint][0],scene.end[joint][0])} {...animation}/><animate attributeName="y2" values={cycle(scene.start[joint][1],scene.end[joint][1])} {...animation}/></line>) : null}
      {exercise.id === 'ex-leg-curl' || exercise.id === 'ex-leg-extension' ? <circle className="exercise-motion-load" cx={scene.start[8][0]} cy={scene.start[8][1]} r="7"><animate attributeName="cx" values={cycle(scene.start[8][0],scene.end[8][0])} {...animation}/><animate attributeName="cy" values={cycle(scene.start[8][1],scene.end[8][1])} {...animation}/></circle> : null}
      {exercise.id === 'ex-leg-press' ? <line className="exercise-motion-apparatus" x1={scene.start[8][0]-9} y1={scene.start[8][1]-9} x2={scene.start[10][0]+9} y2={scene.start[10][1]+9}><animate attributeName="x1" values={cycle(scene.start[8][0]-9,scene.end[8][0]-9)} {...animation}/><animate attributeName="y1" values={cycle(scene.start[8][1]-9,scene.end[8][1]-9)} {...animation}/><animate attributeName="x2" values={cycle(scene.start[10][0]+9,scene.end[10][0]+9)} {...animation}/><animate attributeName="y2" values={cycle(scene.start[10][1]+9,scene.end[10][1]+9)} {...animation}/></line> : null}
      {exercise.id==='ex-hip-thrust' && <circle className="exercise-motion-load" cx={scene.start[2][0]} cy={scene.start[2][1]} r="13">
        <animate attributeName="cy" values={cycle(scene.start[2][1],scene.end[2][1])} {...animation}/>
      </circle>}
      {exercise.id==='ex-breathing-reset' && <ellipse className="exercise-motion-breath" cx={midpoint(scene.start[1],scene.start[2])[0]} cy="129" rx="21" ry="8">
        <animate attributeName="ry" values="8;11;11;8;8" {...animation}/>
      </ellipse>}
    </svg>
    <figcaption>{exercise.name}<small>{scene.trajectory}</small></figcaption>
  </figure>
}
