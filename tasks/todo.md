# TODO — Rodak

**FASE 0 CERRADA (2026-07-21).** Staging vivo y verificado:
https://rodak.fromdevdiego.com (200 TLS válido, 6 productos del seed, 5432
aislado, robots noindex). Archive report en engram
(`sdd/fase-0-fundaciones/archive-report`, obs #526). Deploy necesitó 3
fixes de Dockerfile: PR #10 (chown node), #11 (wget healthcheck),
#12 (`HOSTNAME=0.0.0.0`) — detalle en `tasks/lessons.md`.

**FASE 1 PLANIFICADA (2026-07-21).** Planning SDD completo de
`fase-1-catalogo` en engram: explore #533, proposal #535, spec #537,
design #538 (rev 2), tasks #540 (rev con delivery resuelto). Catálogo
real: **~111 productos** (no 89), 20 categorías. Decisiones cerradas:
Store API pública, nombres exactos Woo, hotlink imágenes + remotePatterns,
priceCents regular + `salePriceCents`, descripciones texto plano,
`stock` se mantiene + `inStock` nuevo (migración solo aditiva), `wooId`
provenance, bajas en origen = solo reporte.

PRÓXIMO PASO al retomar: **`sdd-apply fase-1-catalogo` con modelo Opus**
(decisión de Facu). Entrega: **4 PRs secuenciales a main** (stacked-to-main;
slices mapeados en el artefacto de tasks). Gate de cierre: corrida real
export→transform→import contra la API viva + doble corrida (idempotencia),
no vitest verde.

## Pendientes que arrastra la Fase 1

- [x] **Nombres del seed**: RESUELTO — se importan los nombres exactos de
      WooCommerce con sufijo ("Vancouver Paraíso", etc.); el upsert por slug
      pisa los 6 nombres cortos del seed. Se materializa en el apply.
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
