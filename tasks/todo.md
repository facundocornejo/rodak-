# TODO — Rodak (Fase 0: cierre de infra)

Estado: código completo (PRs #1–#9 mergeados, main `2777858`). Coolify YA
instalado y sano en el VPS (verificado por SSH 2026-07-20). Falta la infra
de la app. **Guía operativa paso a paso: `DEPLOY-PASO-A-PASO.md` (raíz)** —
la ejecuta Facu en Cloudflare/Coolify y Claude verifica cada paso.
PRÓXIMO PASO al retomar: Paso 1 (registro A `rodak`, nube gris).

## Infra staging (requiere a Facu — Cloudflare + dashboard Coolify)

- [ ] **DNS**: registro A `rodak` → IP del VPS en Cloudflare, **gray cloud**
      (DNS only) hasta que Let's Encrypt emita el cert. Hoy
      `rodak.fromdevdiego.com` NO resuelve (verificado contra 1.1.1.1).
- [ ] **Postgres en Coolify**: New Resource → Postgres. NUNCA "make it
      publicly available". Copiar la connection string INTERNA
      (`postgres://…@<container>:5432/…`).
- [ ] **App en Coolify**: New Resource → Application → GitHub App →
      `facundocornejo/rodak-`, branch `main`. Build pack **Dockerfile**
      (`docker/Dockerfile`, contexto raíz). Puerto 3000. Healthcheck `/`.
      Volumen persistente en `/app/.next/cache`. Concurrent builds = 1.
      Límites de recursos ~1.5× uso esperado.
- [ ] **Start command**: `npx prisma migrate deploy && npm run db:check-drift && node server.js`
      (el orden importa — ver README "Detecting schema drift").
- [ ] **Env vars en la UI de Coolify** (nunca en el repo):
      - `DATABASE_URL` = string interna del Postgres del paso 2
      - `STAGING_HOST` = `rodak.fromdevdiego.com`
      - `SITE_URL` = vacía (recién en Fase 6)
      - `NODE_ENV` = `production` (confirmar que Coolify lo setea)
- [ ] **Seed staging**: correr `prisma/seed.ts` contra la DB de staging
      (una vez, tras el primer deploy con migraciones OK).
- [ ] **Deploy** + checklist de verificación del README (curl 200 con TLS,
      productos del seed en el body, `nmap -p 5432` desde afuera = cerrado,
      log de deploy con los 3 pasos en orden).
- [ ] Después de verificar: **sdd-archive** de `fase-0-fundaciones`.

## Seed vs rodak.ar en vivo (verificado 2026-07-20 — decisión de Facu)

Los 6 slugs del seed resuelven 200 en `rodak.ar/producto/{slug}/`. Hallazgos:

- [x] **Precio desactualizado**: `cajonera-kendall` — seed $389.900,00 vs
      vivo $487.848,00 (+25,1%). Actualizado a `priceCents: 48784800` en este
      mismo PR (2026-07-20).
- [ ] **Nombres**: 4 de 6 en vivo llevan sufijo de material/marca que el
      seed omite — "Vancouver **Paraíso**", "Franklin **Paraiso**",
      "Soporte Auricular **Rodak**", "Soporte Celular **Rodak**". ¿Sincronizar
      o mantener los nombres limpios del seed? (decisión de diseño).
- Nota: `escritorio-vancouver` es producto variable en vivo
  ($527.640 – $983.939 según medida); el seed usa el precio de la medida
  mínima — coherente con el modelo de 1 variante actual.
- Nota: el sitio muestra 10% extra por transferencia; no afecta el precio
  de lista.

## Menores

- [ ] Crear `.env.example` en la raíz (Claude tiene denegada la escritura de
      `.env*` por permisos — contenido listo abajo, copiar y pegar).
- [ ] Decisión Facu: provenance de los 5 commits de la Unidad 3; la IP
      redactada sigue en el historial git público (borrarla del todo =
      reescribir historia).
- [ ] Cuando upstream mergee el fix del issue #1329 de gentle-ai, volver al
      binario oficial (hoy corre el patcheado en `B:\tools\gentle-ai\`).

## Contenido listo para `.env.example`

```bash
# Environment variables reference — Rodak store
#
# Copy to `.env` for local development. Staging/production values are NEVER
# set in this repo: they live in the Coolify UI (see README "Deployment").
# Only dev-only values appear literally here (they are already public in
# docker-compose.dev.yml); everything else stays as a placeholder.

# --- Required ---

# Postgres connection string (Prisma). Local dev uses the docker-compose.dev.yml
# instance: host port 5434 (not 5432 — this machine runs other Postgres).
# Staging: use the Coolify Postgres resource's INTERNAL docker-network URL
# (postgres://…@<container-name>:5432/…), never a published/public port.
DATABASE_URL="postgresql://rodak:rodak_dev_only@localhost:5434/rodak_dev"

# --- Staging only (set in Coolify UI, not locally) ---

# Exact staging subdomain. Drives robots.ts noindex + metadataBase
# (see src/lib/site-url.ts). Leave unset in local dev.
# STAGING_HOST="rodak.fromdevdiego.com"

# --- Production cutover only (Fase 6 — leave unset until then) ---

# Real production origin. Takes precedence over STAGING_HOST in
# src/lib/site-url.ts; setting it early makes robots.ts/metadataBase treat
# the deploy as real production.
# SITE_URL="https://rodak.ar"

# NODE_ENV is set by tooling (next dev/build) and by Coolify in staging —
# do not set it here.
```

## Archivado (hecho)

- Fase 0 código: PR #1 esqueleto, #2 catálogo, #3 deploy-pipeline, #4
  hardening CI, #5 dependabot, #6 follow-ups app, #7 redactar IP. Todos
  mergeados con review 4R/1-lente + receipt approved + CI verde.
