import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../../types/training'
import { USER_LICENSED_MEDIA } from './userMediaManifest'
import { ExerciseMotion } from './ExerciseMotion'

// Lossless sprite frames preserve the licensed GIF's pixels and timing. A canvas
// permits actual pause/resume, unlike restarting an animated <img> on every pause.
export function LicensedExerciseMotion({ exercise, paused }: { exercise: Exercise; paused: boolean }) {
  const media = USER_LICENSED_MEDIA[exercise.id]
  const canvas = useRef<HTMLCanvasElement>(null)
  const timeline = useRef(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!media || media.durations.length < 2 || failed) return
    const node = canvas.current
    const context = node?.getContext('2d')
    if (!node || !context) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const sprite = new Image()
    let alive = true
    let request = 0
    let previous = 0
    const duration = media.durations.reduce((sum, value) => sum + value, 0)
    const render = (now: number) => {
      if (!alive) return
      const stopped = paused || reduced.matches
      if (previous && !stopped) timeline.current = (timeline.current + now - previous) % duration
      previous = now
      let offset = 0
      let frame = 0
      while (frame < media.durations.length - 1 && offset + media.durations[frame] <= timeline.current) offset += media.durations[frame++]
      context.clearRect(0, 0, media.width, media.height)
      context.drawImage(sprite, 0, frame * media.height, media.width, media.height, 0, 0, media.width, media.height)
      node.dataset.frameIndex = String(frame)
      node.dataset.animationPaused = String(stopped)
      request = stopped ? 0 : requestAnimationFrame(render)
    }
    const preferenceChanged = () => {
      previous = 0
      if (!request && sprite.complete && sprite.naturalWidth) request = requestAnimationFrame(render)
    }
    reduced.addEventListener('change', preferenceChanged)
    sprite.onload = () => { if (alive) request = requestAnimationFrame(render) }
    sprite.onerror = () => { if (alive) setFailed(true) }
    sprite.src = media.sprite
    return () => { alive = false; cancelAnimationFrame(request); reduced.removeEventListener('change', preferenceChanged); sprite.onload = null; sprite.onerror = null }
  }, [media, paused, failed])
  if (!media || media.durations.length < 2 || failed) return <ExerciseMotion exercise={exercise} paused={paused} />
  return <figure className="exercise-motion-scene exercise-motion-scene--licensed" data-motion-id={`licensed-${exercise.id}`}>
    <canvas ref={canvas} width={media.width} height={media.height} role="img" aria-label={`Movimiento de ${exercise.name}. Gymvisual, media licenciada del usuario.`} />
    <figcaption>{exercise.name}<small>Gymvisual · media licenciada del usuario</small></figcaption>
  </figure>
}
