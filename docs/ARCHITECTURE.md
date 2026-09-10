# FÉNIX — Arquitectura vigente

## Estado

Arquitectura objetivo de FÉNIX v2.1 (`2.1.0-rc.1`). La base funcional es FÉNIX v2.0.0 CORE STABLE y se preserva su modelo de datos.

## Runtime

- React 19 + TypeScript.
- Vite como toolchain y empaquetador.
- PWA mediante `vite-plugin-pwa` / Workbox.
- Persistencia local-first en IndexedDB mediante Dexie.
- Database: `fenix-db`.
- Schema vigente: `5`.
- Migraciones v2.1: `NONE`.
- Sin backend runtime, Supabase runtime, login, cloud sync ni wrapper nativo.
- Despliegue estático compatible con Cloudflare Pages.

## Capas

1. **Shell / Design System** — navegación primaria Hoy · Training · Nutrition · Progreso; Ajustes es jerarquía secundaria. `AppHeader`, `Dialog`, `Sheet`, feedback, estado offline y actualización PWA son primitives compartidas.
2. **Dominio** — cada módulo conserva ownership propio. Hoy orquesta/consume; Training posee sesiones; Nutrition posee alimentación; Progreso deriva métricas y conserva su propio historial.
3. **Persistencia** — servicios de dominio escriben directamente sobre Dexie bajo fronteras transaccionales. Las mutaciones con estado/version siguen `transaction → reread → validate → write current.version+1 → commit → publish`.
4. **Freshness** — invalidación post-commit para que consumidores recarguen únicamente hechos confirmados.
5. **Recovery** — export snapshot coherente, validator común pre/post restore, restore atómico y comparación semántica.
6. **PWA** — shell/offline local, actualización por prompt y diferida mientras exista una sesión Training activa.
7. **Media** — registro canónico 33/33: 26 mappings RepDB + 7 assets FÉNIX. Los frames RepDB autorizados se copian selectivamente desde `@repdb/exercises@2026.8.1` durante dev/build y se sirven desde el mismo origen; thumbnails seed se precachean y los detalles restantes usan CacheFirst. `ExerciseMotion` local es fallback offline/reduced-motion.

## Identidades e invariantes preservados

- Training formal mantiene identidad por instancia `PlannedWorkoutSession`; same-day no colapsa sesiones.
- Nutrition Training meal mantiene `date + role + trainingSessionId`.
- Racha canónica usa `scheduledDate → createdAt → id` y sigue siendo por instancia, no por día.
- Hechos históricos completed/skipped no se reescriben por planificación posterior.
- Un máximo de una `WorkoutSession` activa.
- Un máximo de un `NutritionGoal` activo.
- Ingredient activo único por nombre normalizado y ShoppingItem activo único por `ingredientId + normalizedUnit`.

## Fecha local

Las superficies v2.1 consumen una utilidad temporal común. La fecha civil es local; no se deriva de UTC para representar el día de usuario. Se prueban Europe/Madrid y cambios DST.

## Seeds

Los seeds son bootstrap **insert-only por ID**. No usan `bulkPut` para sobrescribir, resucitar o normalizar datos editados/archivados por el usuario.

## Backup

Backup/Restore forma parte del contrato P0:
- lectura coherente de las 26 tablas schema-5;
- tablas vacías incluidas;
- prevalidación antes de `clear()`;
- restore `clear + bulkPut + appMeta` en una sola transacción;
- postvalidación con el mismo validator;
- semantic diff;
- rollback ante excepción.

## Testing

- suites CORE B01/B02/RC1/RC1.1/RC2/RC2.1/RC2.2;
- domain tests v2.1;
- mutation/concurrency/negative/fault matrices;
- Playwright E2E en viewport iPhone;
- visual parity matrix contra 26 Golden Renders;
- offline/PWA/backup smoke.
