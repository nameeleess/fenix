# FÉNIX

Aplicación personal local-first para rutina diaria, entrenamiento, nutrición y progreso.

## Candidata actual

`2.1.0-rc.1` — Ingeniería, aún no release final.

## Runtime

- React + TypeScript + Vite
- PWA / Workbox
- Dexie / IndexedDB
- `fenix-db`, schema 5
- offline-first
- sin backend runtime, login o cloud sync

## Desarrollo

```bash
npm ci
npm run dev
npm run build
npm run lint
```

## QA

```bash
npm run test:v21
npm run test:core
npm run test:e2e
npm run test:visual
```

Los tests E2E/visual requieren Chromium de Playwright. La candidata de Ingeniería debe superar además backup/restore real, offline, mutation/concurrency/fault matrices y los 26 Golden Renders antes del handoff a CENTRAL.

## Datos

Los datos viven en IndexedDB local. Export/restore JSON está disponible desde **Ajustes → Datos y backup**. No borres IndexedDB para actualizar la app.

## Media

Media Freeze v2.1: 33/33 mappings, 26 RepDB + 7 FÉNIX propios. Attribution/licensing se documenta en `qa/v2.1/LICENSE_ATTRIBUTION_REGISTRY_v2.1.md`.
