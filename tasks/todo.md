# TODO — Rodak

**FASE 0 CERRADA (2026-07-21).** Staging vivo y verificado:
https://rodak.fromdevdiego.com (200 TLS válido, 6 productos del seed, 5432
aislado, robots noindex). Archive report en engram
(`sdd/fase-0-fundaciones/archive-report`, obs #526). Deploy necesitó 3
fixes de Dockerfile: PR #10 (chown node), #11 (wget healthcheck),
#12 (`HOSTNAME=0.0.0.0`) — detalle en `tasks/lessons.md`.

PRÓXIMO PASO al retomar: **Fase 1 — migración de catálogo** (import
WooCommerce, ver PLAN-MAESTRO.md). Arrancar con `sdd-new`.

## Pendientes que arrastra la Fase 1

- [ ] **Nombres del seed**: 4 de 6 productos en vivo llevan sufijo
      ("Vancouver **Paraíso**", "Franklin **Paraiso**", "Soporte Auricular
      **Rodak**", "Soporte Celular **Rodak**") que el seed omite —
      decisión de diseño al importar el catálogo real.
- [ ] Crear `.env.example` en la raíz (lo pega Facu — contenido listo en
      `git show 2777858:tasks/todo.md`, sección "Contenido listo").
- [ ] Decisión Facu: provenance de los 5 commits de la Unidad 3; la IP
      redactada sigue en el historial git público.
- [ ] Cuando upstream mergee el fix del issue #1329 de gentle-ai, volver al
      binario oficial (hoy corre el patcheado en `B:\tools\gentle-ai\`).
- [ ] Optimización posterior (no urgente): nube naranja de Cloudflare + SSL
      Full strict para `rodak` (PERFORMANCE.md §4).

## Archivado (hecho)

- Fase 0 completa: PRs #1–#9 (código, CI, docs) + #10–#12 (fixes de deploy).
  Infra Coolify: GitHub App, Postgres 18 interno, Application Dockerfile,
  healthcheck, volumen `rodak-next-cache-v2`, limits 2g/2cpu, envs en UI.
  Seed corrido (6 productos). Verificación externa Paso 8 con evidencia.
