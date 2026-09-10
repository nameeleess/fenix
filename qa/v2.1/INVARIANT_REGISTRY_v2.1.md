# INVARIANT REGISTRY — FÉNIX v2.1

## Global

- `fenix-db`, schema 5; no v2.1 migration.
- No reset/reseed is required to upgrade from CORE STABLE.
- Mutation events publish only after commit.
- Rejected operations produce no write/version/event.
- Seeds are insert-only and do not overwrite or resurrect persisted user state.

## Today

- Max one active `DailyRoutine` per date.
- Max one active `WorkShift` per date.
- A DailyRoutineTask active references an active DailyRoutine.
- Completed/skipped task facts are not silently rewritten by template edits.
- Day 0 is a deliberate UI state; absence of started routine is not failure/adherence loss.

## Training

- Max one active `WorkoutSession` globally.
- Active WorkoutSessionExercise/ExerciseSet have valid active operational parents.
- Active ExerciseSet `order` unique per `workoutSessionExerciseId + setType`.
- A completed/incomplete terminal session retains at least one active completed working set.
- Planned↔execution relation is bidirectional and status-compatible.
- `substituteSessionExercise` cannot rewrite a completed set.
- Same-day planned sessions preserve independent IDs.
- Canonical streak ordering: `scheduledDate → createdAt → id`; policy unchanged from CORE.
- Routine/editor writes never rewrite completed historical session snapshots.

## Nutrition

- Training meal pending identity: `date + role + trainingSessionId` unique.
- Non-Training managed meal identity remains per day/role where contract applies.
- Completed/skipped/manual meals are protected from automatic replanning.
- Exactly 0 or 1 active NutritionGoal; >1 is integrity error.
- Improvised logical submission ID yields at most one completed DailyMeal.
- Active RecipeIngredient → active Recipe + active Ingredient.
- Active ShoppingItem → active Ingredient.
- Active Ingredient normalized name is unique (`trim → toLocaleLowerCase('es')`).
- Active ShoppingItem logical identity unique by `ingredientId + (trimmed unit || null)`; unit case is preserved.
- Week apply is all-or-nothing and idempotent.
- Recipe updates/deletes do not rewrite historical DailyMeal snapshots.

## Progress

- Weight correction updates an existing fact; deletion is a separate logical action.
- Body measurement correction and deletion remain separate.
- Trend: 7-day vs prior 7-day requires >=3 valid entries in both periods; missing days neutral.
- Training streak is derived from the shared canonical policy, never persisted independently.
- Featured exercises reference active Exercises.

## Backup / Restore

- Snapshot includes every schema-5 table, including empty tables.
- Counts, IDs, totalRecords and schema metadata must agree.
- Prevalidation occurs before any destructive write.
- Restore is one transaction; any error rolls back original DB.
- Postvalidation uses the same validator as prevalidation.
- Runtime parent/child and logical uniqueness invariants are represented by restore validation.
- Official 759-record baseline must remain valid and semantically roundtrip.

## PWA / UI

- Four primary nav modules only: Hoy, Training, Nutrition, Progreso.
- Settings is secondary hierarchy, not a fifth tab.
- PWA update does not automatically interrupt an active WorkoutSession.
- Offline state is visible and local data remains available after valid prior load.
- Shared Dialog/Sheet provides focus management, Escape, focus restoration and scroll lock.
