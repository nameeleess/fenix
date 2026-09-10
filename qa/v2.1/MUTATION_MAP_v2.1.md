# MUTATION MAP — FÉNIX v2.1

Candidate: `2.1.0-rc.1.2`  
Database: `fenix-db` / schema 5 / migrations NONE.

Pattern required for stateful/concurrent mutations: **transaction → reread current → validate → atomic write → current.version+1 → commit → publish freshness**.

| Area | Mutation(s) | Transaction stores | Current-state checks / invariant | Publication |
|---|---|---|---|---|
| Hoy | `startDay` | dailyRoutines | reread routine; only active/nondeleted; idempotent start | post-commit Today |
| Hoy | `setDailyTaskStatus`, `updateDailyTask`, `deleteOneOffTask` | dailyRoutineTasks | reread active task; current version; no resurrect | post-commit Today |
| Hoy | `addOneOffTask` | dailyRoutines + dailyRoutineTasks | current routine/date active; order derived inside tx | post-commit Today |
| Hoy | `upsertWorkShift`, `setWorkShiftStatus` | workShifts | singleton active shift/date; current version | post-commit Today |
| Hoy | `saveRoutineTemplate` | template + items + routines + tasks + appMeta | atomic Settings changes; historical/completed/skipped facts not rewritten | post-commit Today |
| Hoy | `promoteOneOffTaskToRoutine` | template + items + routines + tasks | source one-off still valid; insert/update future template atomically | post-commit Today |
| Training CORE | start/toggle/add/remove/finish/discard/reprogram/substitute | session/planned/snapshot/set/template/exercise stores as required | CORE causal lifecycle; active session; parent/linkage/version/completion | post-commit Training |
| Training editor | `updateRoutineExercise` | workoutTemplateExercises | reread active relation; current version | post-commit Training |
| Training editor | `createWorkoutTemplate`, `updateWorkoutTemplate` | templates + templateExercises + exercises | duplicate/name/config validation; children written atomically | post-commit Training |
| Training editor | `duplicateWorkoutTemplate` | templates + templateExercises + exercises | source template/config/exercise parents reread inside tx; copy is created from one coherent current snapshot | post-commit Training |
| Training editor | `archiveWorkoutTemplate` | templates + planned sessions | reject when operational child would lose active parent | post-commit Training |
| Training custom exercise | create/update/archive | exercises (+ referencing template/session stores where needed) | system exercise protected; current state/version; operational refs protected | post-commit Training |
| Training personal context | `updateExercisePersonalContext` | exercises | reread active exercise; current version | post-commit Training |
| Nutrition recipe | create/update/delete/favorite | recipes + recipeIngredients + ingredients | current Recipe; active parents; snapshot/history preserved | post-commit Nutrition |
| Nutrition catalog | create/update/delete Ingredient | ingredients + recipeIngredients + recipes + shoppingItems | normalized active name unique; child/parent lifecycle | post-commit Nutrition |
| Nutrition basket | add/update/toggle/remove/clear | ingredients + shoppingItems (+ RecipeIngredient/Recipe for relation add) | `ingredientId + normalizedUnit` singleton; current versions; clear atomic | post-commit Nutrition |
| Nutrition day | appetite/replace/portion/status | nutritionDays + dailyMeals + recipes + planned sessions as applicable | pending/manual/completed/skipped policy; current version | post-commit Nutrition |
| Nutrition week | `applyNutritionWeek` | planned sessions + recipes + goals + days + meals | full-week atomic/idempotent; historical facts preserved | post-commit Nutrition |
| Nutrition goal | `updateNutritionGoal` | nutritionGoals | reread all active; >1 corruption error; <=1 singleton after commit | post-commit Nutrition |
| Improvised meal | `addImprovisedMeal` | dailyMeals | stable submission identity; retry idempotent | one post-commit Nutrition event |
| Progress weight | add/update/delete | weightEntries | same-day comparable policy; current version; no resurrect | post-commit Progress |
| Progress body | add/update/delete | bodyMeasurements | current version; logical delete separate from correction | post-commit Progress |
| Progress featured | `setFeaturedExercises` | progressFeaturedExercises + exercises | exercise parents active; replace set atomically | post-commit Progress |
| Backup export | export | all schema-5 tables read transaction | coherent cross-table snapshot | none; appMeta export metadata after file generation |
| Backup restore | restore | all schema-5 tables rw transaction | prevalidate before writes; clear+put+postvalidate+semantic diff; rollback on any error | post-success freshness only |

## Horizontal closure notes

- No v2.1 mutation introduces `read outside → wait → stale write` as its final correctness boundary.
- UI busy/submitting guards exist where double interaction is plausible, but correctness remains service-side.
- Template edits affect future planning; historical execution snapshots remain facts.
- Backup validator includes runtime logical identities for Ingredient and ShoppingItem.
- Root-cause sweep v2.1 discovered and closed a stale-snapshot window in `duplicateWorkoutTemplate()` before PRE-QA; the regression is retained in the Training editor mutation suite.
