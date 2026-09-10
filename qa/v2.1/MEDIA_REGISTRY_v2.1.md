# MEDIA REGISTRY — FÉNIX v2.1

Composición runtime vigente (CUTOVER-14): **33/33 = 31 media licenciada del usuario + 1 RepDB + 1 FÉNIX**. Mapping individual, masters, derivados y hashes: `evidence/USER_MEDIA_MAPPING.json`. Licencia/trazabilidad: `evidence/USER_MEDIA_LICENSE_REGISTRY.md`.

Los 33 masters se conservan sin modificación. Se integran 31 equivalencias verificadas. El GIF titulado Jalón al pecho muestra un pullover de brazos rectos y el de Remo T no tiene apoyo torácico: se conservan las representaciones correctas anteriores para esos dos ejercicios. No cambia la identidad del catálogo.

Las copias runtime son WebP lossless locales: poster, peak y sprite con tiempos originales. Canvas permite pausa real y reduced-motion; Side Plank tiene un único frame y usa su pose licenciada junto al motion SVG específico. Las otras 30 animaciones licenciadas tienen endpoints distintos. Los masters no son dependencias de red.

## Inventario anterior conservado como fallback técnico

La tabla siguiente documenta el fallback **26 RepDB + 7 FÉNIX**, no la composición principal actual.

| # | Exercise ID | Source | Source ID / asset | Offline |
|---:|---|---|---|---|
| 1 | `ex-bench-press` | REPDB | `bench-press` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 2 | `ex-incline-dumbbell-press` | REPDB | `incline-db-press` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 3 | `ex-cable-fly` | REPDB | `cable-fly` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 4 | `ex-pull-up` | REPDB | `pull-up` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 5 | `ex-lat-pulldown` | REPDB | `lat-pulldown` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 6 | `ex-chest-supported-row` | REPDB | `chest-supported-db-row` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 7 | `ex-chest-supported-tbar-row` | FENIX | `fenix-chest-supported-tbar-row` | local precache |
| 8 | `ex-seated-cable-row` | REPDB | `seated-cable-row` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 9 | `ex-lateral-raise` | REPDB | `lateral-raise` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 10 | `ex-face-pull` | REPDB | `face-pull` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 11 | `ex-bayesian-curl` | FENIX | `fenix-bayesian-curl` | local precache |
| 12 | `ex-incline-dumbbell-curl` | REPDB | `incline-db-curl` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 13 | `ex-hammer-curl` | REPDB | `hammer-curl` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 14 | `ex-ez-bar-curl` | REPDB | `ez-bar-curl` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 15 | `ex-triceps-pushdown` | REPDB | `tricep-pushdown` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 16 | `ex-overhead-triceps-extension` | FENIX | `fenix-overhead-cable-triceps` | local precache |
| 17 | `ex-hack-squat` | REPDB | `hack-squat` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 18 | `ex-leg-press` | REPDB | `leg-press` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 19 | `ex-leg-extension` | REPDB | `leg-extension` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 20 | `ex-leg-curl` | REPDB | `leg-curl` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 21 | `ex-hip-thrust` | REPDB | `hip-thrust` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 22 | `ex-rdl` | REPDB | `romanian-deadlift` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 23 | `ex-seated-calf-raise` | REPDB | `seated-calf-raise` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 24 | `ex-standing-calf-raise` | REPDB | `standing-calf-raise` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 25 | `ex-cat-cow` | REPDB | `cat-cow` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 26 | `ex-open-book` | FENIX | `fenix-open-book` | local precache |
| 27 | `ex-90-90-hip-switch` | FENIX | `fenix-9090-hip-switch` | local precache |
| 28 | `ex-hip-flexor-stretch` | REPDB | `kneeling-hip-flexor-stretch` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 29 | `ex-wall-slides` | FENIX | `fenix-wall-slides` | local precache |
| 30 | `ex-bird-dog` | REPDB | `bird-dog` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 31 | `ex-dead-bug` | REPDB | `dead-bug` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 32 | `ex-side-plank` | REPDB | `side-plank` | @repdb/exercises local WebP + cache-on-use + local ExerciseMotion fallback |
| 33 | `ex-breathing-reset` | FENIX | `fenix-breathing-mobility` | local precache |

## Freeze assertions

- Curl femoral: `ex-leg-curl → RepDB leg-curl`, lying canonical.
- Cada mapping posee `motionId` específico y profile propio.
- Los siete FÉNIX SVG están bajo `public/media/exercises/fenix/`.
- RepDB no se redistribuye como dataset dentro del SOURCE; se referencia/cachea como media de aplicación y siempre existe fallback local.
- `prefers-reduced-motion` reduce/pausa animación.


## Build provenance

RepDB mappings are sourced from `@repdb/exercises@2026.8.1`. `npm run media:sync` verifies package version/license/attribution files, validates every frozen `sourceId` and declared `images.flat` source path against `exercises.json`, then copies only those 26 mappings into canonical FÉNIX runtime filenames under `public/media/exercises/repdb/2026.8.1/`. RepDB source filenames may legitimately differ from the exercise ID (for example `standing-calf-raise` declares `machine-calf-raise-*` images); FÉNIX normalizes only the generated local destination name. The generated directory is git-ignored and is not a redistributed dataset.
