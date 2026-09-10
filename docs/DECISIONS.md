# FÉNIX — Registro de decisiones

Las decisiones históricas no se eliminan; cuando dejan de representar el runtime se marcan como superseded.

## ADR-001 — Stack inicial con backend potencial

**Estado:** SUPERSEDED para runtime v2.x.

La arquitectura inicial contempló servicios cloud/Supabase. No representa el runtime CORE STABLE ni v2.1.

## ADR-002 — Local-first como arquitectura runtime

**Estado:** ACTIVA.

FÉNIX usa React + TypeScript + Vite + PWA + Dexie/IndexedDB. Database `fenix-db`, schema 5. No existe backend runtime, login ni sync cloud.

## ADR-003 — CORE v2.0.0 como baseline inmutable de comportamiento

**Estado:** ACTIVA.

v2.1 puede modificar UI y ampliar superficies, pero no cambia ownership, historial, identidad Training/Nutrition, política de racha, schema ni semántica de hechos confirmados.

## ADR-004 — Design System v2

**Estado:** ACTIVA en v2.1.

Las superficies comparten primitives de header, tabs, buttons, cards, estado, media, dialog/sheet, feedback y PWA. No se añade una nueva capa táctica de override global para corregir pantallas individualmente.

## ADR-005 — Media Freeze v2.1

**Estado:** ACTIVA.

Resolución CENTRAL de STOP-MEDIA-01: 33/33 ejercicios, 26 RepDB + 7 FÉNIX propios. Curl femoral usa `RepDB leg-curl`, variante lying como representación canónica. La resolución supersede solo los contadores 25+8 previos.

## ADR-006 — Semántica de media offline

**Estado:** ACTIVA.

Assets FÉNIX se empaquetan localmente. Las 26 referencias RepDB se obtienen en build desde `@repdb/exercises@2026.8.1`, se copian selectivamente como media in-app y se sirven desde el mismo origen; los detalles usan CacheFirst y los thumbnails de rutinas seed se precachean. `ExerciseMotion` local específico por ejercicio actúa como fallback offline y se detiene/reduce bajo `prefers-reduced-motion`.

## ADR-007 — Fecha civil compartida

**Estado:** ACTIVA.

Los módulos usan una única utilidad de fecha local. Week start es lunes y se evita convertir el día civil mediante UTC.

## ADR-008 — Seeds insert-only

**Estado:** ACTIVA.

Un seed solo inserta un ID inexistente. Nunca reescribe ni resucita una entidad persistida por el usuario.

## ADR-009 — PWA update seguro

**Estado:** ACTIVA.

Las actualizaciones se presentan mediante prompt. Si existe una `WorkoutSession` activa, la aplicación difiere la actualización para no interrumpir una sesión real.

## ADR-010 — QA v2.1

**Estado:** ACTIVA.

La candidata solo vuelve a CENTRAL tras PRE-QA adversarial, mutation map, concurrencia, fault/negative testing, backup/restore, E2E, visual gate, offline y regresión CORE. QA independiente no recibe micro-entregas desde Ingeniería.
