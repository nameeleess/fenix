# FÉNIX — Arquitectura

## Estado

Arquitectura v1.0 aprobada.

## Objetivo

FÉNIX es una aplicación personal para centralizar rutina, entrenamiento, nutrición y progreso.

La plataforma prioritaria es iPhone, manteniendo compatibilidad con ordenadores, tablets y otros teléfonos.

## Principios

- Local-first
- Offline-first
- Privacy by design
- Mobile first
- Integridad de datos
- Coste mínimo
- Bajo vendor lock-in
- Arquitectura simple y mantenible

## Stack aprobado

### Frontend
- React
- TypeScript
- Vite

### Aplicación
- Progressive Web App (PWA)

### Persistencia local
- IndexedDB
- Dexie.js

### Backend y sincronización
- Supabase
- PostgreSQL

### Hosting
- Cloudflare Pages

### Versionado
- Git

### Exportación
- JSON
- CSV

## Módulos principales

- Hoy / Rutina
- Training
- Nutrition
- Progress

## Regla estructural

La interfaz no constituye la fuente de verdad de los datos.

Los datos y la lógica de dominio deben permanecer desacoplados de su representación visual.