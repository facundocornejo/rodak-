# TODO — Rodak

**Fases 0 y 1 CERRADAS Y ARCHIVADAS.** Staging vivo con el catálogo real:
https://rodak.fromdevdiego.com sirve 88 productos (placeholders del seed
eliminados, PR #22), 272 variantes, 21 categorías, 317 imágenes, robots en
`Disallow: /`. Archive reports en engram: Fase 0 obs #526, Fase 1 obs #557.

**FASE 2 (`fase-2-pdp`): PLANNING COMPLETO (24/07) — LISTA PARA APPLY.**
Artefactos en engram: explore #591, proposal #593 (GATE 1 ✓), spec #595
(enmendado en GATE 2: tab Specs = datos estructurados), design #596 (GATE 2 ✓,
decisiones D0–D14), tasks #598 (52 tasks en 9 PRs stacked-to-main). Gate
documental de trazabilidad: CLOSE. Plan y revisión externa en la raíz:
`PLAN-FASE-2-PLANNING.md`, `CODEX-REVIEW-VEREDICTO.md`.

**PRÓXIMO PASO: apply de fase-2-pdp — CON OPUS, en sesión fresca.**
1. Facu cambia el modelo con `/model` a Opus ANTES de arrancar (decisión
   explícita: planning Fable, ejecución Opus).
2. `sdd-apply fase-2-pdp` — el ejecutor lee SOLO tasks #598 (+ spec/design
   referenciados). Delivery: auto-chain, stacked-to-main, un receipt = un
   commit. PR8 (health) ANTES del cutover manual de Coolify y ese ANTES de
   PR9 (streaming de `/`) — orden D1b, no negociable.
3. OJO gentle-ai: si hay archivos sueltos en la raíz (p.ej. `.agents/`,
   `.codex/`, `AGENTS.md` de Codex) — usar `--projection staged` como manda
   la lección del 22/07. Los docs del planning y `.env.example` ya están
   commiteados.

## Pendientes que arrastra la Fase 1

- [x] **Nombres del seed**: RESUELTO — se importan los nombres exactos de
      WooCommerce con sufijo ("Vancouver Paraíso", etc.); el upsert por slug
      pisa los nombres cortos del seed.
- [x] **5 productos placeholder del seed quedaron huérfanos**: RESUELTO
      (24/07) — borrados de staging con `npm run catalog:prune -- --confirm`
      (script nuevo `scripts/catalog/prune.ts`, dry-run por defecto, toma los
      targets de `removedAtOrigin` del reconciliation report y se niega a
      borrar cualquier slug que el snapshot todavía publique, borra por `id` y
      deja un backup JSON de las filas en `data/woo-snapshot/pruned-*.json`).
      Staging y DB local: 93 → 88 productos, 277 → 272 variantes, 317 imágenes
      intactas; la home sirve 88 items y `/producto/soporte-celular/` da 404.
      Ya no pueden resucitar: el seed de placeholders quedó retirado.
- [ ] **7 variantes "A medida (consultar)" con `priceCents = 0`** (decisión de
      Facu: importarlas igual). La UI de Fase 2 DEBE tratar `priceCents === 0`
      como "consultar precio" — mostrarlo como precio lee "gratis". La lista
      exacta queda en `data/woo-snapshot/reconciliation-report.json`.
- [x] **`.env.example` en la raíz**: RESUELTO (24/07) — Facu lo creó (los
      hooks bloquean que el agente escriba `.env*`) y quedó commiteado con
      los docs del planning de Fase 2. Variables verificadas contra
      `src/lib/site-url.ts`, `src/lib/db.ts` y `docker-compose.dev.yml`.
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

- **Fase 0** — PRs #1–#9 (código, CI, docs) + #10–#12 (fixes de deploy: chown
  node, wget healthcheck, `HOSTNAME=0.0.0.0`; lecciones en `tasks/lessons.md`).
  Infra Coolify: GitHub App, Postgres 18 interno, Dockerfile, healthcheck,
  volumen `rodak-next-cache-v2`, limits 2g/2cpu, envs en UI.
- **Fase 1** — PRs #15 (schema aditivo), #16 (export), #17 (transform + tests),
  #18 (import + gate de corrida real). El catálogo tiene **88 productos**, no
  ~111 (ese número salía de un resumen de WebFetch; verificado por X-WP-Total,
  sitemap y el fetch real). Idempotencia probada en local y staging.
  La review 4R atajó tres CRITICAL que los tests no habrían encontrado: oferta
  más cara que el precio regular guardada como descuento, producto variable sin
  ninguna variante con precio, y renombrar un producto en Woo (cambia el slug
  pero no el `wooId`, que es `@unique`) rompiendo la idempotencia para siempre.
  Para recargar staging: túnel SSH `-L 15432:10.0.1.7:5432` al VPS (10.0.1.7 =
  contenedor `hwnfzqbj5e9k574g2r2r1a1q` en la red `coolify`), la `DATABASE_URL`
  sale del contenedor de la app vía `docker inspect` y se reescribe al puerto
  del túnel — nunca a disco.
