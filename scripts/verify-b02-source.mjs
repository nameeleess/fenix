import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [database, training, policy, page, css, freshness, today, mealIdentity] = await Promise.all([
  readFile(new URL('../src/db/database.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/training/trainingService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/training/trainingIntegrityPolicy.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/training/TrainingPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/training/training.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/freshnessEvents.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/today/todayService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/nutrition/dailyMealIdentity.ts', import.meta.url), 'utf8'),
])

assert.match(database, /CURRENT_SCHEMA_VERSION = 5/, 'schema must remain 5')
assert.doesNotMatch(database, /\[scheduledDate\+workoutTemplateId\]/, 'same-day identity must not be made unique')
assert.doesNotMatch(database, /&\[scheduledDate/, 'no same-day unique compound index may be introduced')

const createStart = training.slice(training.indexOf('async function createSessionFromTemplate'), training.indexOf('export async function startPlannedWorkout'))
assert.match(createStart, /db\.transaction\([\s\S]*db\.workoutSessions[\s\S]*db\.plannedWorkoutSessions/, 'start must use one rw transaction covering executions and planning')
assert.match(createStart, /where\('status'\)[\s\S]*equals\('active'\)[\s\S]*filter\(\(session\) => session\.deletedAt === null\)/, 'active execution must be revalidated inside start transaction')
assert.match(createStart, /const planned = await db\.plannedWorkoutSessions\.get\(plannedWorkoutId\)/, 'planned must be re-read inside start transaction')
assert.ok(createStart.indexOf("where('status')") < createStart.indexOf('db.workoutSessions.add(prepared.session)'), 'active check must happen before execution creation')
assert.ok(createStart.indexOf('const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)') < createStart.indexOf('db.workoutSessions.add(prepared.session)'), 'planned revalidation must precede writes')
assert.match(createStart, /planned\.status === 'in_progress'/, 'in_progress must be handled explicitly')
assert.match(createStart, /execution\.plannedWorkoutId !== planned\.id/, 'execution linkage must be validated')
assert.match(createStart, /activeSessions\[0\]\.plannedWorkoutId === planned\.id/, 'pending+existing linked execution inconsistency must not be silently repaired')

const finish = training.slice(training.indexOf('export async function finishWorkout'), training.indexOf('export async function discardEmptyWorkout'))
assert.match(finish, /session\.status !== 'active'/, 'finish must require active execution')
assert.match(finish, /planned\.status !== 'in_progress'/, 'finish must revalidate planning transition')
assert.match(finish, /planned\.executionSessionId !== session\.id/, 'finish must preserve planned/execution linkage')

const discard = training.slice(training.indexOf('export async function discardEmptyWorkout'), training.indexOf('export async function omitPlannedWorkout'))
assert.match(discard, /session\.status !== 'active'/, 'discard must require active execution')
assert.match(discard, /planned\.status !== 'in_progress'/, 'discard must revalidate planning')

const reprogram = training.slice(training.indexOf('export async function reprogramPlannedWorkout'), training.indexOf('export async function substituteSessionExercise'))
assert.match(reprogram, /assertValidTrainingDateKey\(newDate\)/, 'reprogram must use calendar validator')
assert.match(reprogram, /planned\.scheduledDate === newDate[\s\S]*return false/, 'same-date reprogram must no-op')
assert.match(reprogram, /if \(changed\)[\s\S]*publishCommittedMutation\('training'\)/, 'same-date no-op must not publish')

assert.match(training, /sessions: PlannedWorkoutSession\[\]/, 'week view must expose all same-day identities')
assert.match(training, /getPlannedWorkoutSessionsForDate/, 'reusable same-day selector must exist')
assert.match(training, /sessions,\s*session: sessions\[0\] \?\? null/, 'singular compatibility field must be derived from non-destructive collection')
assert.match(page, /day\.sessions\.length > 1/, 'UI must make same-day multiplicity observable')
assert.match(page, /day\.sessions\.map/, 'UI must expose each same-day identity')
assert.match(training, /actionableSessions: PlannedWorkoutSession\[\]/, 'Training home must expose all actionable identities')
assert.match(page, /home\.actionableSessions\.slice\(1\)\.map/, 'secondary actionable identities must remain individually operable')
assert.match(css, /training-same-day-session/, 'same-day UI must remain styled without redesign')

assert.match(training, /validateSetValues\(values, set\.setType, 'draft'\)/, 'draft updates must share domain validator')
assert.match(training, /validateSetValues\(values, set\.setType, 'complete'\)/, 'completion must share domain validator')
assert.match(policy, /assertNullableFiniteNonNegative\(values\.weight, 'Peso'\)/, 'weight must use finite non-negative validator')
assert.match(policy, /!Number\.isFinite\(value\) \|\| value < 0/, 'weight helper must reject non-finite/negative values')
assert.match(policy, /Number\.isInteger\(values\.reps\)/, 'reps must be integer')
assert.match(policy, /values\.rir < 0 \|\| values\.rir > 10/, 'RIR must be 0..10')
assert.match(policy, /setType === 'warmup'[\s\S]*values\.rir !== null/, 'warmup RIR must never persist')

assert.match(freshness, /publish/, 'B01 post-commit infrastructure must remain present')
assert.match(today, /assertPersistenceCurrent/, 'B01 Today rollback guard must remain present')
assert.match(mealIdentity, /trainingSessionId/, 'B01 Nutrition Training identity must remain present')



const homeProjection = training.slice(training.indexOf('const week: TrainingWeekDayView[]'), training.indexOf('const focusTemplate'))
assert.doesNotMatch(homeProjection, /activePlanned\.find\(\(item\) => item\.scheduledDate === date/, 'week projection must not collapse same-day identities with find()')
assert.match(homeProjection, /const actionableSessions = \[[\s\S]*\.\.\.overdue[\s\S]*\.\.\.todayActionable[\s\S]*\.\.\.futurePending/, 'focus/next must derive from a non-destructive actionable collection')

const saveDraft = training.slice(training.indexOf('export async function saveSetDraft'), training.indexOf('export async function toggleSetCompletion'))
assert.match(saveDraft, /db\.transaction\('rw', db\.exerciseSets, async \(\) => \{/, 'saveSetDraft must use one rw transaction over exerciseSets')
assert.match(saveDraft, /const set = await db\.exerciseSets\.get\(setId\)/, 'saveSetDraft must re-read the set inside its write transaction')
assert.match(saveDraft, /const validationMode = set\.completedAt === null \? 'draft' : 'complete'/, 'saveSetDraft must derive validation mode from persisted completedAt')
assert.ok(saveDraft.indexOf('const set = await db.exerciseSets.get(setId)') < saveDraft.indexOf('const validationMode'), 'saveSetDraft must read current state before deciding validation mode')
assert.ok(saveDraft.indexOf('validateSetValues(values, set.setType, validationMode)') < saveDraft.indexOf('db.exerciseSets.update'), 'saveSetDraft must validate current-domain values before persistence')
assert.ok(saveDraft.indexOf("})\n\n  publishCommittedMutation('training')") > saveDraft.indexOf('db.exerciseSets.update'), 'saveSetDraft event must be outside/after the transaction')

const toggle = training.slice(training.indexOf('export async function toggleSetCompletion'), training.indexOf('export async function addExerciseSet'))
assert.match(toggle, /const outcome = await db\.transaction\([\s\S]*db\.workoutSessions[\s\S]*db\.workoutSessionExercises[\s\S]*db\.exerciseSets/, 'toggleSetCompletion must use one rw transaction covering session, snapshot and set')
assert.match(toggle, /const set = await db\.exerciseSets\.get\(setId\)/, 'toggleSetCompletion must re-read the current set inside the transaction')
assert.match(toggle, /const session = await db\.workoutSessions\.get\(set\.workoutSessionId\)/, 'toggleSetCompletion must re-read the parent session inside the transaction')
assert.match(toggle, /session\.deletedAt !== null/, 'toggleSetCompletion must reject a soft-deleted session')
assert.match(toggle, /session\.status !== 'active'/, 'toggleSetCompletion must reject a terminal session')
assert.match(toggle, /const snapshot = set\.workoutSessionExerciseId[\s\S]*db\.workoutSessionExercises\.get\(set\.workoutSessionExerciseId\)/, 'toggleSetCompletion must re-read the snapshot when linked')
assert.match(toggle, /snapshot\.deletedAt !== null/, 'toggleSetCompletion must reject a soft-deleted snapshot')
assert.match(toggle, /snapshot\.workoutSessionId !== session\.id/, 'toggleSetCompletion must validate snapshot/session linkage')
assert.ok(toggle.indexOf('const session = await db.workoutSessions.get(set.workoutSessionId)') < toggle.indexOf('if (set.completedAt !== null)'), 'toggle lifecycle validation must precede completion decision')
assert.ok(toggle.indexOf('const set = await db.exerciseSets.get(setId)') < toggle.indexOf('if (set.completedAt !== null)'), 'toggle decision must use the current transactional set state')
assert.ok(toggle.indexOf("validateSetValues(values, set.setType, 'draft')") < toggle.indexOf('completedAt: null'), 'uncomplete path must validate resulting draft domain before write')
assert.ok(toggle.indexOf("validateSetValues(values, set.setType, 'complete')") < toggle.lastIndexOf('db.exerciseSets.update'), 'completion validation must precede completion write')
assert.ok(toggle.lastIndexOf("publishCommittedMutation('training')") > toggle.indexOf('const outcome = await db.transaction'), 'toggle event must be published after transaction completion')

assert.match(reprogram, /scheduledDate: newDate/, 'reprogram must only change effective scheduledDate')
assert.match(reprogram, /rescheduleCount: planned\.rescheduleCount \+ 1/, 'effective reprogram increments count exactly once')
assert.doesNotMatch(reprogram, /originalScheduledDate:/, 'reprogram must not rewrite originalScheduledDate')
assert.doesNotMatch(reprogram, /workoutTemplateId:/, 'reprogram must not rewrite template identity')
assert.doesNotMatch(reprogram, /status: 'completed'|status: 'incomplete'|status: 'omitted'/, 'reprogram must not resolve planning')


const addSet = training.slice(training.indexOf('export async function addExerciseSet'), training.indexOf('export async function removeExerciseSet'))
assert.match(addSet, /db\.transaction\([\s\S]*db\.workoutSessions[\s\S]*db\.workoutSessionExercises[\s\S]*db\.exerciseSets/, 'addExerciseSet must use one rw transaction covering session, snapshot and sets')
assert.match(addSet, /const snapshot = await db\.workoutSessionExercises\.get\([\s\S]*workoutSessionExerciseId/, 'addExerciseSet must re-read snapshot inside transaction')
assert.match(addSet, /snapshot\.deletedAt !== null/, 'addExerciseSet must reject soft-deleted snapshot')
assert.match(addSet, /const session = await db\.workoutSessions\.get\(snapshot\.workoutSessionId\)/, 'addExerciseSet must re-read parent session inside transaction')
assert.match(addSet, /session\.deletedAt !== null/, 'addExerciseSet must reject soft-deleted session')
assert.match(addSet, /session\.status !== 'active'/, 'addExerciseSet must reject terminal session')
assert.match(addSet, /snapshot\.workoutSessionId !== session\.id/, 'addExerciseSet must validate snapshot/session linkage')
assert.ok(addSet.indexOf('const snapshot = await db.workoutSessionExercises.get') < addSet.indexOf('const currentSets ='), 'parent revalidation must precede nextOrder calculation')
assert.ok(addSet.indexOf('const currentSets =') < addSet.indexOf('const nextOrder ='), 'nextOrder must use current transactional sets')
assert.ok(addSet.indexOf('const nextOrder =') < addSet.indexOf('db.exerciseSets.add'), 'nextOrder and insert must be in the same transaction')
assert.ok(addSet.lastIndexOf("publishCommittedMutation('training')") > addSet.indexOf('db.transaction'), 'successful add event must publish only after transaction completion')

console.log('F2-B02 source invariants: PASS')
