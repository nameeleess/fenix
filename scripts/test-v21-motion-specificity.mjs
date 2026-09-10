import assert from 'node:assert/strict'
import { EXERCISE_MOTION_SCENES as scenes } from '../src/features/training/media/exerciseMotionScenes.ts'
import { EXERCISE_MEDIA_REGISTRY as media } from '../src/features/training/media/exerciseMediaRegistry.ts'

assert.deepEqual(Object.keys(scenes).sort(), media.map(item => item.exerciseId).sort())
const signatures = new Map()
for (const [id, scene] of Object.entries(scenes)) {
  assert.equal(scene.start.length, 11, id)
  assert.equal(scene.end.length, 11, id)
  assert.ok(scene.equipment && scene.orientation && scene.trajectory && scene.apparatus, id)
  for (const pose of [scene.start, scene.end]) for (const [x, y] of pose) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 240 && y >= 0 && y <= 170, `${id}: bounded joint`)
  }
  // Translation, absolute scale, motion ID, phase and duration are excluded.
  // Compare the actual relative geometry of both endpoints and joint displacements.
  const length = Math.hypot(scene.start[1][0]-scene.start[2][0], scene.start[1][1]-scene.start[2][1])
  const signature = JSON.stringify([scene.start, scene.end].map(pose => pose.map(point => point.map((v, axis) => Math.round((v-pose[2][axis])/length*100)))))
  assert.ok(!signatures.has(signature), `${id}: full scene duplicates ${signatures.get(signature)}`)
  signatures.set(signature, id)
}
const same = (id, joints) => joints.forEach(i => assert.deepEqual(scenes[id].start[i], scenes[id].end[i], `${id}: fixed joint ${i}`))
same('ex-leg-curl', [0,1,2,3,4,5,6,7,9])
assert.ok(scenes['ex-leg-curl'].end[8][1] < scenes['ex-leg-curl'].start[7][1], 'lying curl heel folds above knee')
same('ex-pull-up', [4,6])
assert.ok(scenes['ex-pull-up'].end[0][1] < scenes['ex-pull-up'].start[0][1], 'pull-up moves body toward fixed bar')
same('ex-leg-extension', [0,1,2,3,4,5,6,7,9])
assert.ok(scenes['ex-leg-extension'].end[8][0] > scenes['ex-leg-extension'].start[8][0], 'extension moves lower leg forward')
same('ex-rdl', [8,10])
assert.ok(scenes['ex-rdl'].end[2][0] > scenes['ex-rdl'].start[2][0], 'RDL hip hinge backwards')
same('ex-open-book', [2,7,8,9,10])
same('ex-bird-dog', [0,1,2,5,6,7,8])
same('ex-dead-bug', [0,1,2,5,6,7,8])
for (const id of ['ex-bird-dog', 'ex-dead-bug']) {
  assert.notDeepEqual(scenes[id].start[4], scenes[id].end[4], `${id}: near arm extends`)
  assert.notDeepEqual(scenes[id].start[10], scenes[id].end[10], `${id}: contralateral far leg extends`)
}
same('ex-wall-slides', [0,1,2,7,8,9,10])
// Every catalog exercise has biomechanical constraints, independent of its
// motion identifier, timing, amplitude or profile metadata.
const fixedJoints = {
  'ex-bench-press': [0,1,2,7,8,9,10],
  'ex-incline-dumbbell-press': [0,1,2,7,8,9,10],
  'ex-cable-fly': [0,1,2,7,8,9,10],
  'ex-pull-up': [4,6],
  'ex-lat-pulldown': [0,1,2,7,8,9,10],
  'ex-chest-supported-row': [0,1,2,7,8,9,10],
  'ex-chest-supported-tbar-row': [0,1,2,7,8,9,10],
  'ex-seated-cable-row': [0,1,2,7,8,9,10],
  'ex-lateral-raise': [0,1,2,7,8,9,10],
  'ex-face-pull': [0,1,2,7,8,9,10],
  'ex-bayesian-curl': [0,1,2,3,5,6,7,8,9,10],
  'ex-incline-dumbbell-curl': [0,1,2,3,5,7,8,9,10],
  'ex-hammer-curl': [0,1,2,3,5,7,8,9,10],
  'ex-ez-bar-curl': [0,1,2,3,5,7,8,9,10],
  'ex-triceps-pushdown': [0,1,2,3,5,7,8,9,10],
  'ex-overhead-triceps-extension': [0,1,2,3,5,7,8,9,10],
  'ex-hack-squat': [8,10],
  'ex-leg-press': [0,1,2,3,4,5,6],
  'ex-leg-extension': [0,1,2,3,4,5,6,7,9],
  'ex-leg-curl': [0,1,2,3,4,5,6,7,9],
  'ex-hip-thrust': [0,1,8,10],
  'ex-rdl': [8,10],
  'ex-seated-calf-raise': [0,1,2,3,4,5,6],
  'ex-standing-calf-raise': [],
  'ex-cat-cow': [3,4,5,6,7,8,9,10],
  'ex-open-book': [1,2,3,4,7,8,9,10],
  'ex-90-90-hip-switch': [0,1,2,3,4,5,6],
  'ex-hip-flexor-stretch': [8,9,10],
  'ex-wall-slides': [0,1,2,7,8,9,10],
  'ex-bird-dog': [0,1,2,5,6,7,8],
  'ex-dead-bug': [0,1,2,5,6,7,8],
  'ex-side-plank': [0,1,3,4,8,10],
  'ex-breathing-reset': [0,7,8,9,10],
}
assert.deepEqual(Object.keys(fixedJoints).sort(), Object.keys(scenes).sort())
for (const [id, joints] of Object.entries(fixedJoints)) same(id, joints)
const travel = (id, joint, axis, sign) => assert.ok((scenes[id].end[joint][axis] - scenes[id].start[joint][axis]) * sign > 0, `${id}: required joint trajectory`)
for (const id of ['ex-bench-press','ex-incline-dumbbell-press','ex-chest-supported-row','ex-chest-supported-tbar-row','ex-bayesian-curl','ex-incline-dumbbell-curl','ex-hammer-curl','ex-ez-bar-curl','ex-overhead-triceps-extension']) travel(id,4,1,-1)
for (const id of ['ex-lat-pulldown','ex-triceps-pushdown']) travel(id,4,1,1)
for (const id of ['ex-seated-cable-row','ex-face-pull','ex-lateral-raise']) travel(id,4,0,-1)
travel('ex-cable-fly',4,0,1)
travel('ex-hack-squat',2,1,1)
travel('ex-leg-press',8,1,-1)
travel('ex-hip-thrust',2,1,-1)
travel('ex-seated-calf-raise',8,1,-1)
travel('ex-standing-calf-raise',0,1,-1)
travel('ex-open-book',6,1,-1)
travel('ex-90-90-hip-switch',7,0,1)
travel('ex-90-90-hip-switch',9,0,1)
travel('ex-hip-flexor-stretch',2,0,1)
travel('ex-side-plank',2,1,-1)
console.log('Motion structural regression PASS: 33 endpoint geometries; biomechanical anchors verified. Visual specificity review remains a separate gate.')
