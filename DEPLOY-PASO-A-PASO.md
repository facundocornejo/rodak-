# Deploy de staging — paso a paso (Rodak → Coolify)

**Actualizado: 2026-07-20.** Guía operativa para levantar la app en el VPS.
Cada paso dice quién lo hace: **[Facu]** = dashboard/Cloudflare, **[Claude]** =
verificación desde la PC. Al terminar cada paso de Facu, avisar a Claude para
verificar antes de seguir.

> **Nota repo público:** la IP del VPS no se escribe acá. Donde diga
> `<IP_DEL_VPS>`, copiala del registro A `coolify` que ya existe en
> Cloudflare (o del panel de netcup).

## Estado verificado hoy (2026-07-20)

- ✅ Código completo en `main` (`2777858`, PRs #1–#9 mergeados, CI verde).
  El seed ya tiene el precio corregido de la Cajonera Kendall ($487.848).
- ✅ Coolify instalado y sano en el VPS: dashboard en
  **https://coolify.fromdevdiego.com** (SSL Let's Encrypt OK), UFW con solo
  22/80/443 abiertos.
- ❌ `rodak.fromdevdiego.com` no existe todavía en DNS.
- ❌ Ninguna Application ni Database creada en Coolify.

---

## Paso 0 — [Facu] Tener a mano

1. Login de **Cloudflare** (dominio `fromdevdiego.com`).
2. Login del **dashboard Coolify**: https://coolify.fromdevdiego.com
3. Cuenta de **GitHub** logueada (por si hay que instalar la GitHub App).

## Paso 1 — [Facu] DNS en Cloudflare

En https://dash.cloudflare.com → `fromdevdiego.com` → **DNS → Records →
Add record**:

| Campo | Valor |
|---|---|
| Type | `A` |
| Name | `rodak` |
| IPv4 address | `<IP_DEL_VPS>` (la misma del registro `coolify` que ya está en la lista) |
| Proxy status | **DNS only (nube GRIS)** — clic en la nube naranja para apagarla |
| TTL | Auto |

**Por qué nube gris:** Traefik necesita que el challenge de Let's Encrypt
llegue directo al server para emitir el certificado. La nube naranja
(+ SSL Full strict) es una optimización posterior (PERFORMANCE.md §4), no
de hoy.

**→ Avisar a Claude:** verifica con `nslookup` antes de seguir.

## Paso 2 — [Facu] Fuente GitHub en Coolify (solo si falta)

Dashboard → **Sources** (menú lateral). Si ya existe una GitHub App
conectada a `facundocornejo`, saltear este paso.

Si no existe: **+ Add → GitHub App** → nombre libre (ej. `coolify-facu`) →
seguir el wizard (te lleva a GitHub) → **Install** sobre la cuenta
`facundocornejo` → dar acceso al repo **`rodak-`** (con "Only select
repositories" alcanza). Volver a Coolify y confirmar que la Source figura
como conectada.

## Paso 3 — [Facu] Postgres en Coolify

1. **Projects** → proyecto (crear uno `rodak` si no hay) → environment
   `production` → **+ New → Database → PostgreSQL** (la versión que ofrezca
   por defecto está bien, 16/17).
2. Nombre del recurso: `rodak-staging-db` (para reconocerlo).
3. ⛔ **NUNCA activar "Make it publicly available"** — un puerto publicado
   por Docker saltea UFW y queda expuesto a internet aunque el firewall
   diga otra cosa (regla dura del proyecto, design D7).
4. **Start** y esperar estado `running:healthy`.
5. Copiar la connection string **interna** (campo "Postgres URL
   (internal)" o similar): tiene la forma
   `postgres://postgres:<password>@<nombre-contenedor>:5432/postgres`.
   Esa es la que va en `DATABASE_URL` — **no** la pública, **no**
   `localhost`.

## Paso 4 — [Facu] La Application

En el mismo proyecto/environment → **+ New → Application** → elegir
**Private Repository (with GitHub App)** → seleccionar
`facundocornejo/rodak-`, branch **`main`**.

Configuración (pestañas de la app):

| Setting | Valor | Dónde |
|---|---|---|
| Build Pack | **Dockerfile** (NO Nixpacks — rompe con Prisma/OpenSSL, design D6) | General |
| Dockerfile Location | `/docker/Dockerfile` | General |
| Base Directory | `/` (raíz del repo — el Dockerfile espera `package.json` y `prisma/` ahí) | General |
| Domains | `https://rodak.fromdevdiego.com` | General |
| Ports Exposes | `3000` | General/Network |
| **Connect To Predefined Network** | ✅ activado — sin esto la app no ve al contenedor de Postgres por nombre | Settings/Network |
| Healthcheck | enabled, path `/`, puerto `3000` | Healthcheck |
| Storage/Volume | mount path **`/app/.next/cache`** (nombre ej. `rodak-next-cache`) — sin esto cada deploy re-encodea todas las imágenes AVIF/WebP | Storages |
| Resource limits | memoria ~`2g`, CPU ~`2` (server compartido, regla 1.5× del runbook) | Advanced |

**Start command: no tocar.** Ya viene en el `CMD` del Dockerfile:
`npx prisma migrate deploy && npm run db:check-drift && node server.js`
(el orden migrate → drift-check → server importa; ver README §"Detecting
schema drift").

**Setting del server (una vez):** en **Servers → localhost → Settings**,
**Concurrent builds = 1** (los builds de Next han tirado servers de 8 GB
por OOM en esta plataforma).

## Paso 5 — [Facu] Variables de entorno

Pestaña **Environment Variables** de la app (nunca en el repo):

| Variable | Valor | Build Variable? |
|---|---|---|
| `DATABASE_URL` | la string **interna** del Paso 3.5 | No |
| `STAGING_HOST` | `rodak.fromdevdiego.com` | No |
| `NODE_ENV` | `production` (Coolify suele setearlo solo — confirmar que esté) | No |
| `SITE_URL` | **NO crearla** (recién en el cutover real, Fase 6 — si se setea antes, robots.ts deja de marcar noindex) | — |

## Paso 6 — [Facu] Primer deploy

Botón **Deploy**. Qué esperar en el log:

1. Build de la imagen (primera vez: varios minutos; baja `node:24-slim`
   por digest, `npm ci`, `prisma generate`, `next build`).
   - Si el build muere con **exit 137** (OOM): agregar
     `NODE_OPTIONS=--max-old-space-size=4096` como env var **de build**
     antes de subir los límites.
2. Arranque del contenedor, en este orden exacto:
   - `prisma migrate deploy` → aplica `1 migration`
   - `db:check-drift` → exit 0 (recién creada la DB, migrada en el paso
     anterior — el orden evita el falso positivo del primer deploy)
   - `▲ Next.js ... Ready` en el puerto 3000
3. Healthcheck en verde (le pega a `/` DESDE ADENTRO del contenedor con el
   `curl` que la imagen instala para esto).

**Nota:** `/` responde 500 mientras la DB no sea alcanzable — la página
consulta la DB y propaga errores a propósito (es el healthcheck). Con la DB
vacía pero migrada responde 200 con "Catálogo en construcción." — eso ya es
éxito; los productos llegan en el paso 7 con el import, no con un seed.

## Paso 7 — [Facu] Cargar el catálogo en staging (una sola vez)

> **Cambió en la Fase 1.** Este paso decía "correr el seed" y esperaba
> `Seed complete. 6 products in the database.`. Ese seed de placeholders se
> retiró: `prisma/seed.ts` ya no escribe productos y falla a propósito. Lo que
> carga staging ahora es el catálogo real de rodak.ar.

El import corre desde la máquina de Facu contra el Postgres de Coolify por un
túnel SSH (el Postgres NO tiene puerto público). El procedimiento completo del
túnel está en la memoria del proyecto; en una línea:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -L 15432:<ip-del-contenedor-postgres>:5432 root@<vps>
DATABASE_URL="postgresql://...@127.0.0.1:15432/postgres" npm run catalog:export
DATABASE_URL="postgresql://...@127.0.0.1:15432/postgres" npm run catalog:import
```

Salida esperada del import: `88 product(s)` en la línea `database` del
resumen. Recargar https://rodak.fromdevdiego.com → 88 productos, con la
Cajonera Kendall Paraíso a **$ 487.848**.

## Paso 8 — [Claude] Verificación final (checklist del README)

La corre Claude desde afuera del VPS y pega la evidencia:

- [ ] `curl -sSI https://rodak.fromdevdiego.com/` → 200 con certificado
      Let's Encrypt válido (sin `-k`).
- [ ] El body contiene los nombres del catálogo importado (DB + migraciones +
      import end-to-end).
- [ ] Scan externo del puerto 5432 → **cerrado** (aislamiento de red de la
      DB; solo 22/80/443 responden).
- [ ] Log del deploy muestra los 3 pasos en orden (migrate → drift-check →
      server).
- [ ] (Ya cumplido hoy: CI reporta pass/fail por SHA en `main`.)

## Paso 9 — Cierre

- [Claude] `sdd-archive` de `fase-0-fundaciones` → **Fase 0 CERRADA**.
- Más adelante (optimización, no hoy): nube naranja + SSL **Full
  (strict)** en Cloudflare una vez confirmado el certificado
  (PERFORMANCE.md §4).
