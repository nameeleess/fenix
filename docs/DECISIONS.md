# FÉNIX — Decision Log

## ADR-001 — Arquitectura inicial

**Estado:** Aprobada

**Fecha:** 28/08/2026

**Problema:**

FÉNIX necesita funcionar principalmente en iPhone, también en escritorio y otros móviles, con funcionamiento offline, privacidad, sincronización, bajo coste y mantenimiento razonable.

**Opciones consideradas:**

- Aplicación iOS nativa
- Aplicación híbrida/multiplataforma
- PWA local-first

**Elección:**

PWA local-first.

**Stack:**

React + TypeScript + Vite + IndexedDB/Dexie + Supabase + Cloudflare Pages.

**Motivo:**

Ofrece la mejor relación entre experiencia móvil, compatibilidad multiplataforma, funcionamiento offline, coste, privacidad y mantenibilidad para una aplicación personal.

**Consecuencias:**

- No habrá widgets nativos de iOS inicialmente.
- La aplicación debe poder funcionar sin conexión.
- Supabase no será requisito para registrar datos localmente.
- La sincronización deberá tolerar interrupciones.
- Los datos deberán poder exportarse independientemente de FÉNIX.