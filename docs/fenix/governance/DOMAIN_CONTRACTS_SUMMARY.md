# DOMAIN_CONTRACTS_SUMMARY.md

This is a navigation summary. The complete domain handoffs remain authoritative for detail.

## Hoy

Owns:
- daily routine/template vs daily execution
- task states and one-off tasks
- WorkShift / work-day context
- `AHORA` orchestration

Does not own Training sessions, Nutrition meals or Progress metrics.

Key invariants:
- Today is Home
- `SIN REGISTRAR != incumplimiento`
- template edit does not rewrite historical day
- Day 0 must be truthful
- old pending task must not indefinitely hijack `AHORA`

## Training

Owns:
- routine/template/programming/session execution
- session lifecycle
- exercise/set data
- substitutions
- comparability and performance facts

Key states:
pending / reprogrammed / omitted / in_progress / completed / incomplete

Key invariants:
- explicit finish
- incomplete preserves real work
- reprogramming preserves identity
- one active WorkoutSession
- warm-up vs working sets distinct
- no destructive historical exercise deletion
- custom/routine content administrable in app
- offline active session persistence

## Nutrition

Owns:
- DailyMeal
- recipes / ingredients / recipe ingredients
- goals
- planning
- consumption
- appetite modes
- shopping

Key invariants:
- recipe != daily meal
- planned != consumed
- Pre/Post bind to Training session identity
- Training never asserts consumption
- completed/skipped facts protected
- no automatic rewrite of manual/protected facts
- NutritionGoal active singleton
- improvised meal idempotency via logical submission identity
- Ingredient active normalized-name uniqueness
- Shopping identity = ingredientId + normalizedUnit
- unit normalization remains case-sensitive for content (`kg != KG`)
- runtime and backup validator share identity policy
- seed upgrades non-destructive

## Progreso

Owns:
- weight/body measurements
- trends
- adherence
- streak
- longitudinal derived analytics

Key invariants:
- real vs derived vs insufficient clearly distinguished
- `SIN REGISTRAR != incumplimiento`
- weight trend requires sufficient coverage
- correction != delete
- streak derived from Training facts
- no global fitness score
- no total tonnage as automatic progress proxy
- no invented Nutrition adherence formula

## Cross-module

### Training → Hoy
Hoy presents Training state; Training remains owner.

### Training → Nutrition
Session identity/date/state/timing are context.
Pending Pre/Post follow reprogrammed session identity.
Completed/skipped consumption never moves.

### Training → Progreso
Training provides formal session/performance facts.
Progreso derives streak/adherence/trends.

### Nutrition → Hoy
Hoy presents the contextually relevant meal and confirmed daily progress.

### Nutrition → Progreso
Progreso may derive from known Nutrition facts but cannot turn unknown into failure.

### Progreso → Hoy
Hoy consumes trend/adherence/streak outputs; does not recalculate an alternative truth.
