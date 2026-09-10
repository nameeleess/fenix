import type { Page } from '@playwright/test'
import type { ExerciseSet, WorkoutSession, WorkoutSessionExercise } from '../../../src/types/training'

// Invoked only after UI-starting Upper B in a fresh Playwright browser context.
// It populates existing session/set fields; no application data model changes.
export async function populateGoldenActiveSession(page: Page) {
  await page.evaluate(async () => {
    const request=indexedDB.open('fenix-db')
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    const tx=db.transaction(['workoutSessions','workoutSessionExercises','exerciseSets','appMeta'],'readwrite')
    const all=<T,>(store:string)=>new Promise<T[]>((resolve,reject)=>{const op=tx.objectStore(store).getAll();op.onsuccess=()=>resolve(op.result);op.onerror=()=>reject(op.error)})
    const sessions=await all<WorkoutSession>('workoutSessions')
    const active=sessions.find(session=>session.status==='active'&&session.templateName==='Upper B')
    if(!active) throw new Error('G07 requires an actual UI-started Upper B session')
    const now=new Date().toISOString()
    tx.objectStore('workoutSessions').put({...active,startedAt:new Date(Date.now()-34*60000).toISOString()})
    const snapshots=await all<WorkoutSessionExercise>('workoutSessionExercises')
    const first=snapshots.find(item=>item.workoutSessionId===active.id&&item.order===1)
    if(first?.exerciseId!=='ex-bench-press') throw new Error('G07 first exercise must be Press banca')
    tx.objectStore('workoutSessionExercises').put({...first,targetSets:3,restSeconds:120})
    const sets=(await all<ExerciseSet>('exerciseSets')).filter(item=>item.workoutSessionExerciseId===first.id)
    sets.forEach(item=>tx.objectStore('exerciseSets').delete(item.id))
    const values=[['warmup',1,20,12,null,true],['warmup',2,24,8,null,true],['working',1,24,10,2,true],['working',2,24,8,null,false],['working',3,26,6,null,false]] as const
    for(const [setType,order,weight,reps,rir,done] of values) tx.objectStore('exerciseSets').put({
      id:`visual-active-${setType}-${order}`,createdAt:now,updatedAt:now,deletedAt:null,version:1,
      workoutSessionId:active.id,workoutSessionExerciseId:first.id,exerciseId:first.exerciseId,exerciseName:first.exerciseName,
      setType,order,weight,reps,rir,completedAt:done?now:null,
    })
    // The Golden represents three exercises already started/completed. Keep
    // Press banca as the current exercise while recording one completed work
    // set on exercises two and three so the derived header truthfully reads
    // 3/6 exercises without inventing a separate progress state.
    for (const snapshot of snapshots.filter(item => item.workoutSessionId===active.id && (item.order===2 || item.order===3))) {
      tx.objectStore('exerciseSets').put({
        id:`visual-active-progress-${snapshot.order}`,createdAt:now,updatedAt:now,deletedAt:null,version:1,
        workoutSessionId:active.id,workoutSessionExerciseId:snapshot.id,exerciseId:snapshot.exerciseId,exerciseName:snapshot.exerciseName,
        setType:'working',order:1,weight:null,reps:snapshot.minReps,rir:snapshot.targetRirMin,completedAt:now,
      })
    }
    tx.objectStore('appMeta').put({key:`trainingRestTimer:${active.id}`,value:new Date(Date.now()+84000).toISOString(),updatedAt:now})
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})
    db.close()
  })
}
