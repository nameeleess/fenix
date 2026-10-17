import { db } from '../db/database'
import type { WorkoutSessionExercise } from '../types/training'

// Schema stays at v5. Only missing Training links are completed; existing
// snapshots, execution facts and non-Training tables are never rewritten.
export async function ensureTrainingVNextMigration() {
  await db.transaction('rw', [db.appMeta, db.workoutSessions,
    db.workoutSessionExercises, db.exerciseSets], async () => {
    const key = 'trainingVNextMigrationVersion'
    if ((await db.appMeta.get(key))?.value === '1') return
    const sessions = await db.workoutSessions.toArray()
    for (const session of sessions.filter(item => item.deletedAt === null)) {
      const snapshots = (await db.workoutSessionExercises.where('workoutSessionId').equals(session.id).toArray())
        .filter(item => item.deletedAt === null)
      const sets = (await db.exerciseSets.where('workoutSessionId').equals(session.id).toArray())
        .filter(item => item.deletedAt === null)
      // Existing explicit identity takes precedence, including repeated exercises.
      for (const set of sets) {
        if (!set.workoutSessionExerciseId) continue
        const linked = snapshots.find(item => item.id === set.workoutSessionExerciseId)
        if (!linked || linked.exerciseId !== set.exerciseId) {
          throw new Error('Compatibilidad Training: vínculo histórico ambiguo o inválido; no se han cambiado los datos.')
        }
      }
      const missing = sets.filter(item => !item.workoutSessionExerciseId)
      for (const exerciseId of new Set(missing.map(item => item.exerciseId))) {
        const candidates = snapshots.filter(item => item.exerciseId === exerciseId)
        if (candidates.length > 0) throw new Error('Compatibilidad Training [RV-05]: una serie sin vínculo podría pertenecer a otra aparición del ejercicio; se requiere revisión sin alterar el historial.')
        const group = missing.filter(item => item.exerciseId === exerciseId)
        // Neither series order, timestamps, names nor today's routine identify
        // an original occurrence. Even disjoint order values can belong to two
        // separate occurrences. Do not silently merge them into one snapshot.
        if (sets.filter(item => item.exerciseId === exerciseId).length > 1) {
          throw new Error('Compatibilidad Training [RV-05]: no se pueden distinguir con seguridad las apariciones históricas de un ejercicio. Conserva una copia para su revisión; no se han modificado los datos.')
        }
        let snapshot = candidates[0]
        if (!snapshot) {
          // Do not project today's routine definition onto historical execution.
          const now = new Date().toISOString()
          const historical: WorkoutSessionExercise = {
            id: crypto.randomUUID(), createdAt: session.createdAt, updatedAt: now, deletedAt: null, version: 1,
            workoutSessionId: session.id, sourceTemplateExerciseId: null,
            exerciseId, exerciseName: group[0].exerciseName,
            order: Math.max(0, ...snapshots.map(item => item.order)) + 1,
            targetSets: group.filter(item => item.setType === 'working').length,
            minReps: 0, maxReps: 0, targetRirMin: null, targetRirMax: null,
            restSeconds: 0, substitutedFromExerciseId: null,
            notes: 'Compatibilidad histórica: objetivos originales no disponibles.',
          }
          await db.workoutSessionExercises.add(historical)
          snapshots.push(historical)
          snapshot = historical
        }
        for (const set of group) await db.exerciseSets.update(set.id, {
          workoutSessionExerciseId: snapshot.id,
          updatedAt: new Date().toISOString(), version: set.version + 1,
        })
      }
    }
    await db.appMeta.put({ key, value: '1', updatedAt: new Date().toISOString() })
  })
}
