# TODO — Rodak

**Fases 0 y 1 CERRADAS Y ARCHIVADAS.** Staging vivo con el catálogo real:
https://rodak.fromdevdiego.com sirve 93 items (88 productos reales + 5
placeholders del seed), 277 variantes, 21 categorías, 317 imágenes, robots en
`Disallow: /`. Archive reports en engram: Fase 0 obs #526, Fase 1 obs #557
(verify obs #556: 12 PASS + 1 con desviación autorizada + 0 FAIL).

**PRÓXIMO PASO: Fase 2 — catálogo y PDP rico** (home, grilla de categoría,
búsqueda, PDP con galería, selector de material/medida, tabs). Arrancar con
`sdd-new fase-2-pdp`.

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
