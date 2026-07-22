# TODO — Rodak

**FASE 0 CERRADA (2026-07-21).** Staging vivo y verificado:
https://rodak.fromdevdiego.com (200 TLS válido, 6 productos del seed, 5432
aislado, robots noindex). Archive report en engram
(`sdd/fase-0-fundaciones/archive-report`, obs #526). Deploy necesitó 3
fixes de Dockerfile: PR #10 (chown node), #11 (wget healthcheck),
#12 (`HOSTNAME=0.0.0.0`) — detalle en `tasks/lessons.md`.

**FASE 1 — PIPELINE COMPLETO Y VERIFICADO (2026-07-22).** PRs #15 (schema),
#16 (export), #17 (transform) mergeados; PR#4 cierra el import. Corrida real
contra rodak.ar + Postgres local: **88 productos** (X-WP-Total 88 = sitemap
88; el "~111" de la exploración era erróneo, salía de un resumen de WebFetch),
277 variantes, 21 categorías, 317 imágenes. Idempotencia probada: segunda
corrida 0 created / 88 updated con conteos idénticos. Planning en engram:
explore #533, proposal #535, spec #537, design #538 (rev 2), tasks #540.

PRÓXIMO PASO: cargar el catálogo en **staging** (correr export + import
contra el Postgres de Coolify) para cumplir el hito "88 productos visibles
en rodak.fromdevdiego.com". Después `sdd-verify` y `sdd-archive`.

## Pendientes que arrastra la Fase 1

- [x] **Nombres del seed**: RESUELTO — se importan los nombres exactos de
      WooCommerce con sufijo ("Vancouver Paraíso", etc.); el upsert por slug
      pisa los nombres cortos del seed.
- [ ] **5 productos placeholder del seed quedaron huérfanos** en la DB:
      `cajonera-kendall`, `escritorio-vancouver`, `estanteria-franklin`,
      `soporte-auricular`, `soporte-celular`. Sus equivalentes reales tienen
      slug con sufijo, así que ahora aparecen duplicados en la home. El import
      los reporta pero NO los borra (regla report-only). Decisión de Facu:
      borrarlos a mano o dejarlos.
- [ ] **7 variantes "A medida (consultar)" con `priceCents = 0`** (decisión de
      Facu: importarlas igual). La UI de Fase 2 DEBE tratar `priceCents === 0`
      como "consultar precio" — mostrarlo como precio lee "gratis". La lista
      exacta queda en `data/woo-snapshot/reconciliation-report.json`.
- [ ] Crear `.env.example` en la raíz (lo pega Facu — contenido listo en
      `git show 2777858:tasks/todo.md`, sección "Contenido listo").
- [ ] Decisión Facu: provenance de los 5 commits de la Unidad 3; la IP
      redactada sigue en el historial git público.
- [ ] Cuando upstream mergee el fix del issue #1329 de gentle-ai, volver al
      binario oficial (hoy corre el patcheado en `B:\tools\gentle-ai\`).
- [ ] Optimización posterior (no urgente): nube naranja de Cloudflare + SSL
      Full strict para `rodak` (PERFORMANCE.md §4).
- [ ] **Rehosteo de imágenes** (diferido de Fase 1): hoy hotlink a
      rodak.ar/wp-content; hay que bajarlas y servirlas propias ANTES de
      apagar el sitio viejo (las URLs originales quedan en ProductMedia.url).

## Archivado (hecho)

- Fase 0 completa: PRs #1–#9 (código, CI, docs) + #10–#12 (fixes de deploy).
  Infra Coolify: GitHub App, Postgres 18 interno, Application Dockerfile,
  healthcheck, volumen `rodak-next-cache-v2`, limits 2g/2cpu, envs en UI.
  Seed corrido (6 productos). Verificación externa Paso 8 con evidencia.
