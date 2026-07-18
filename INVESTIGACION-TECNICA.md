# Investigación técnica — Bases del proyecto Rodak

**Fecha:** 2026-07-18
**Origen:** pedido de Facu antes de la fase Tasks: "asegurarnos bien las bases" — arquitectura, seguridad y SEO investigados en fuentes primarias (docs oficiales de Next.js/Prisma/Google/OWASP, repos de referencia, artículos 2024-2026). Tres investigaciones en paralelo con búsqueda web, citas en cada sección.

## Resumen ejecutivo — qué cambia en nuestro diseño

1. **ARQUITECTURA — cambio al design de Fase 0:** la doc oficial de Next.js recomienda para proyectos nuevos un **Data Access Layer (DAL) de funciones** (`lib/data/*.ts` con `import 'server-only'`, único lugar que toca Prisma, devuelve DTOs mínimos) — el acceso directo desde componentes queda para prototipos. Nuestro design decía "Prisma directo sin capas": se corrige a **estructura plana + DAL de funciones desde el día 1** (no es Clean Architecture — son ~4 archivos de funciones). El techo de complejidad lo marca Vercel: borraron 145k líneas de su propio template de commerce por sobreabstracción.
2. **SEO — decisión que había que tomar ANTES de la primera ruta:** con ~90 productos, **conservar la estructura de URLs actual** (`/producto/{slug}/`, `/categoria-producto/{slug}/`) con `trailingSlash: true` = cero redirects en la migración de Fase 6 (cada URL idéntica es una URL que no puede romperse). ~60% de las migraciones pierden tráfico y la causa dominante son redirects rotos. Las rutas del App Router de Fase 0 nacen con esos paths.
3. **SEGURIDAD — reglas permanentes:** el middleware de Next NO es frontera de seguridad (CVE-2025-29927) — auth/authz vive en cada Server Action y en el DAL; Next.js pineado ≥ 15.2.3 y **runbook de upgrades** (hubo RCE crítico en RSC dic-2025 — en el VPS parchear es responsabilidad nuestra); Postgres SIN puerto publicado (red interna de compose — además Docker bypasea UFW); contenedores no-root + `no-new-privileges`; secrets de Compose para password de DB y token MP.
4. **Carrito (Fase 3, decidido ya):** cookie `cartId` + carrito en Postgres (patrón de Next.js Commerce), nunca localStorage (rompe SSR del badge/carrito).
5. **Dinero (confirmado):** `Int` en centavos correcto; evaluar `BigInt` para totales de órdenes (techo de Int: ~$21,4M en centavos ARS — un mueble caro no llega, un total agregado puede). `Prisma.Decimal` descartado con evidencia: rompe al pasar a Client Components.
6. **JSON-LD merchant listing** (Fase 2): Product/Offer con precio formato máquina (`"185000.00"`, `"ARS"`), availability desde stock real, breadcrumbs; **jamás ratings inventados** (acción manual de Google).

Los tres informes completos siguen abajo. Las decisiones ya incorporadas al design de Fase 0 están marcadas en `DECISIONES.md` y en el artefacto de design en engram.

---

# Informe 1 — Arquitectura y patrones (Next.js App Router + Prisma + PostgreSQL self-hosted)

## 1. Estructura de proyecto (App Router, 2025/2026)

**Lo que dice la doc oficial:** Next.js es explícitamente *no-opinionado* sobre organización. La [doc oficial de Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) (v16, actualizada jun-2026) lista tres estrategias válidas y pide una sola cosa: **elegir una y ser consistente**:

1. **Archivos fuera de `app/`** — `app/` solo rutea; `components/`, `lib/` viven en la raíz (o en `src/`).
2. **Archivos dentro de `app/`** en carpetas top-level compartidas.
3. **Split por feature/ruta** — código compartido en la raíz de `app/`, código específico colocado en el segmento de ruta que lo usa (con carpetas privadas `_components/`, `_lib/`).

Herramientas oficiales que conviene usar siempre:
- **Route groups** `(shop)`, `(admin)`: organizan sin afectar la URL y permiten layouts distintos por sección — exactamente el caso tienda vs panel admin. Permiten múltiples root layouts.
- **Carpetas privadas** `_folder` para componentes no-ruteables dentro de `app/`.
- **`src/`** opcional; su único beneficio es separar código de la config de raíz.

**Proyectos de referencia:**
- **[Next.js Commerce de Vercel](https://github.com/vercel/commerce)** (~14.2k estrellas): estructura **plana y por tipo**: `app/` (solo rutas), `components/` (por dominio: `cart/`, `product/`, `layout/`), `lib/`. Para la v2 [eliminaron ~145.000 líneas](https://vercel.com/blog/introducing-next-js-commerce-2-0) del template anterior — señal fuerte de que la sobreabstracción en e-commerce chico es un error conocido.
- **[Medusa Next.js Starter](https://github.com/medusajs/nextjs-starter-medusa)**: `src/` con `app/`, `lib/data/` centralizado, y `modules/` por feature.
- Comunidad ([guía 2025](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji), [patrones App Router](https://dev.to/pipipi-dev/app-router-directory-design-nextjs-project-structure-patterns-31eo)): `app/` fino, lógica en `lib/` o módulos, colocation de lo específico.

**Server actions:** patrón de Next.js Commerce: `actions.ts` junto al feature (ej. `components/cart/actions.ts`). La [doc de seguridad oficial](https://nextjs.org/blog/security-nextjs-server-components-actions) pide que cada action valide input y autorización adentro.

**Estructura recomendada para este proyecto:**

```
src/
  app/
    (shop)/          # storefront: /, /producto/[slug], /carrito, /checkout
    (admin)/admin/   # fase futura, layout propio
    api/webhooks/mercadopago/route.ts
  components/        # por dominio: product/, cart/, ui/
  lib/
    db.ts            # singleton de Prisma
    data/            # DAL: products.ts, cart.ts, orders.ts
    actions/         # o colocadas junto al feature — elegir UNA convención
  types/
prisma/schema.prisma
```

## 2. Acceso a datos: Prisma directo vs capas

**El marco oficial** — post de Sebastian Markbåge en el blog de Next.js, ["How to Think About Security in Next.js"](https://nextjs.org/blog/security-nextjs-server-components-actions), define tres modelos:

| Modelo | Recomendado para |
|---|---|
| **HTTP APIs** (backend separado) | Organizaciones grandes existentes |
| **Data Access Layer (DAL)** — funciones en un módulo único que devuelven DTOs seguros | **Proyectos nuevos** ← este caso |
| **Component-Level** (Prisma directo en el Server Component) | Prototipos y aprendizaje |

El DAL recomendado **no es el patrón Repository de OOP**: son **funciones** (`getProductBySlug()`, `getCart()`) en `lib/data/` que (a) son el único lugar que toca Prisma, (b) devuelven DTOs con solo los campos necesarios, (c) usan `import 'server-only'` para que el build falle si un Client Component las importa. Las clases-repositorio agregan complejidad sin beneficio en Next.js ([Structuring Your Data Access Layer](https://medium.com/@samrose.mohammed/structuring-your-data-access-layer-in-next-js-patterns-that-actually-scale-2e4c07491866)). La postura Clean Architecture completa ([Renaud](https://www.arnaudrenaud.com/articles/clean-architecture-typescript-prisma-next/)) se justifica para dominios complejos con equipos, no para esto.

**Prisma en Next.js:** singleton del client para evitar agotar conexiones con hot-reload ([guía oficial](https://www.prisma.io/docs/orm/more/troubleshooting/nextjs), [guía completa](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-prisma-complete-guide/)).

**N+1** ([doc oficial](https://www.prisma.io/docs/orm/prisma-client/queries/advanced/query-optimization-performance)): nunca `findMany` en loop; `include`/`select` anidado o filtro `in`. Producto + variantes + bundles: un `findUnique` con `include` anidado. Desde el preview `relationJoins`, `relationLoadStrategy: "join"` hace un único JOIN ([anuncio](https://www.prisma.io/blog/prisma-orm-now-lets-you-choose-the-best-join-strategy-preview)) — con 90 productos es prematuro, pero es la salida si aparece.

**Caching de Next para catálogo:**
- Next 15: `fetch` ya no cachea por defecto ([ref](https://realcoding.blog/en/2026/03/07/nextjs-15-fetch-cache-default-change/)) — aplica a `fetch`, no a Prisma.
- Dirección actual: [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) + [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag) + [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) (Cache Components en Next 16; [evolución v14→v16](https://dev.to/ahr_dev/nextjs-caching-evolution-from-v14-to-v15-and-the-cache-components-era-5goo)).
- **Patrón catálogo** ([doc](https://nextjs.org/docs/app/getting-started/revalidating)): páginas de producto cacheadas con tags (`product:${id}`), admin edita → `revalidateTag('product:123')`. Con 90 productos, `generateStaticParams` + revalidación por tag = páginas instantáneas con datos frescos.
- Carrito y checkout **dinámicos siempre** (leen cookies).

**Self-hosting (crítico para el VPS):** según la [guía oficial](https://nextjs.org/docs/app/guides/self-hosting), con **un solo contenedor Docker todo funciona igual que en Vercel** — ISR y revalidación usan `.next/cache` en filesystem. Los problemas (cache handler custom, Redis) aparecen con múltiples instancias ([Flightcontrol](https://www.flightcontrol.dev/blog/secret-knowledge-to-self-host-nextjs)). Para esta tienda: `output: 'standalone'`, un contenedor, volumen para `.next/cache` si se quiere persistir entre deploys.

## 3. Estado del carrito

**Cookie con `cartId` + carrito en la base de datos** — patrón dominante:
- Es exactamente lo que hace Next.js Commerce: server action setea `cookies().set('cartId', ...)` y persiste en backend ([repo](https://github.com/vercel/commerce)).
- **No localStorage:** no existe en el servidor → Server Components no pueden renderizar carrito/badge sin flash de hidratación ([discusión oficial](https://github.com/vercel/next.js/discussions/58434)).
- **No carrito entero en cookie:** límite 4KB; cookie = puntero, DB = datos ([Wiliam](https://www.wiliam.com.au/wiliam-blog/where-should-you-store-your-cart), [schema design](https://dev.to/fabric_commerce/how-do-you-design-a-shopping-cart-database-for-e-commerce-4oeh)). Bonus: habilita merge guest→usuario y análisis de abandono.
- Mutaciones con Server Actions + `revalidateTag('cart')` + `useOptimistic`. `cookies().set()` solo en Server Actions/Route Handlers ([#49843](https://github.com/vercel/next.js/discussions/49843)).
- El `cartId` de la cookie es input hostil — validar que el cart exista y esté abierto ([doc seguridad](https://nextjs.org/blog/security-nextjs-server-components-actions)).

## 4. Manejo de dinero

- Float prohibido; `MONEY` de Postgres desaconsejado ([análisis de tipos](https://cardinalby.github.io/blog/post/best-practices/storing-currency-values-data-types/), [wanago.io](https://wanago.io/2024/03/04/api-nestjs-money-postgresql-prisma/)).
- **`Int` llega a 2.147.483.647 = ~$21,4M en centavos ARS**: un mueble caro está lejos, pero el total de una orden puede acercarse → evaluar `BigInt` (`@db.BigInt`) para totales. `BigInt` serializa mal a JSON — convertir a `number` en el DAL (seguro hasta 2^53).
- **`Prisma.Decimal` tiene un pitfall enorme con App Router**: no es objeto plano y rompe al pasarlo a Client Components ([issue #25960](https://github.com/prisma/prisma/issues/25960), [workarounds](https://www.buildwithmatija.com/blog/centralize-prisma-serialization-nextjs)) — los enteros lo evitan por completo.
- Veredicto: `Int` centavos (o `BigInt` para totales), `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` en presentación ([Honeybadger](https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/)).
- **Frontera MP:** la API espera pesos con decimales — conversión centavos→pesos en un único punto al crear la preference. Webhooks idempotentes keyed por payment ID, 2xx rápido, firma `x-signature` ([guía 2026](https://cesarayala.dev/blog/how-to-integrate-mercado-pago/), [next-mercadopago de goncy](https://github.com/goncy/next-mercadopago)).

## 5. Errores comunes / antipatrones documentados

Del [post oficial de Vercel](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) y complementarias:

1. **Route Handlers innecesarios**: llamar a tu propia `/api` desde un Server Component; endpoints que deberían ser Server Actions.
2. **Overuse de `"use client"`** — antipatrón #1: cada uno arrastra su subtree al bundle. Correcto: clientes **hoja** (botón add-to-cart, selector, galería), composición "donut".
3. **Hydration mismatches con precios/fechas**: locale/timezone distintos server vs cliente. Fix: `Intl.NumberFormat` con locale y currency **explícitos**, fechas UTC formateadas server-side ([LogRocket](https://blog.logrocket.com/how-fix-rsc-hydration-mismatches-next-js/), [doc del error](https://nextjs.org/docs/messages/react-hydration-error)).
4. **Leak de datos en RSC payload**: props a Client Components viajan serializadas al browser. Pasar el objeto Prisma entero = leak clásico. Defensas: DAL con DTOs mínimos, `server-only`, taint API ([doc seguridad](https://nextjs.org/blog/security-nextjs-server-components-actions)).
5. **Suspense mal ubicado** y **olvidar revalidate tras mutaciones**.
6. **Self-hosted específico**: RCE crítico en RSC dic-2025 (CVE-2025-55182, [advisory React](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components), [Unit 42](https://unit42.paloaltonetworks.com/cve-2025-55182-react-and-cve-2025-66478-next/)). En el VPS la actualización de Next/React es responsabilidad operativa nuestra — pin + upgrades regulares en el runbook.

## 6. Veredicto

**Nivel intermedio-bajo: estructura plana estilo Next.js Commerce + DAL de funciones desde el día 1.** Ni Prisma crudo regado por componentes, ni Clean Architecture. Fundamento: (1) la fuente oficial lo dice casi textual — DAL para proyectos nuevos, directo solo prototipos; (2) el costo del DAL es ~4 archivos de funciones, y para un dev entry-level es MÁS fácil (un solo lugar de queries y auditoría); (3) Vercel borró 145k líneas de su template por sobreabstracción; (4) el DAL es la costura exacta para las fases futuras (stock atómico, órdenes, MP viven en esas funciones sin reestructurar).

---

# Informe 2 — Seguridad (VPS + Docker + Caddy + Mercado Pago Bricks)

## 1. Baseline OWASP aplicado a este stack

OWASP Top 10 2025 vigente: A01 Broken Access Control, A02 Security Misconfiguration, A03 Supply Chain, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Integrity Failures, A09 Logging & Alerting, A10 Exceptional Conditions.

### A01 — Broken Access Control (el más crítico)
- **El middleware de Next NO es un security boundary.** CVE-2025-29927 (CVSS 9.1, mar-2025): header `x-middleware-subrequest` salteaba el middleware completo. Lección permanente: auth/authz en **cada** Server Action, Route Handler y en el DAL. Requisito duro: **Next.js ≥ 15.2.3** actualizado.
- **Server Actions son endpoints públicos**: toda action exportada es invocable por POST directo. Re-verificar autenticación Y autorización (ownership — IDOR) adentro de cada una.
- **Patrón Vercel para proyectos nuevos:** DAL `server-only` que centraliza auth + queries y devuelve DTOs mínimos. Solo el DAL lee `process.env`. Órdenes consultables solo con ID no adivinable (cuid/uuid, jamás autoincremental expuesto).
- **Validación:** todo input del cliente (formData, searchParams, params, headers) validado con Zod antes de la DB. Precios/totales JAMÁS del cliente: el total se **recalcula server-side** (regla de oro e-commerce).

### A05 — Inyección
- Prisma parametriza sus métodos normales. `$queryRaw` tagged template también. **`$queryRawUnsafe` con concatenación = SQLi** — prohibirlo por lint; si hiciera falta, placeholders posicionales y allowlist para columnas/ORDER BY.

### XSS en RSC/JSX
- JSX escapa por defecto. Vectores reales: `dangerouslySetInnerHTML` (sanitizar con DOMPurify server-side si hay HTML rico), URLs `javascript:`, datos sin filtrar de Server a Client. Complemento: CSP + taint API.

### CSRF con Server Actions
- Nativo: solo POST; Next compara `Origin` vs `Host`/`X-Forwarded-Host`; SameSite=Lax default.
- Detrás de Caddy: garantizar `X-Forwarded-Host` correcto (el `reverse_proxy` de Caddy lo setea) o `serverActions.allowedOrigins`. Route Handlers custom NO tienen esta protección — validar Origin manual. Cookies admin futuras: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.

### SSRF
- Riesgo en fetch server-side con URLs influenciadas por usuario. Mitigación: allowlist de hosts (solo `api.mercadopago.com` y propios), bloquear IPs privadas, `redirect: 'error'`, `AbortSignal.timeout()`. `images.remotePatterns` específico, nunca wildcard.

Fuentes: https://owasp.org/Top10/2025/ · https://nextjs.org/docs/app/guides/data-security · https://nextjs.org/blog/security-nextjs-server-components-actions · https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries · https://www.nodejs-security.com/blog/prisma-raw-query-sql-injection · https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html · https://justappsec.com/guides/nextjs-ssrf-protection · https://www.authgear.com/post/nextjs-security-best-practices/

## 2. Security headers 2025/2026

| Header | Valor | Dónde |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000` (`includeSubDomains` solo cuando TODOS los subdominios tengan HTTPS; `preload` al final) | Caddy |
| `Content-Security-Policy` | Ver abajo — necesita dominios de MP Bricks | Next (nonce) o Caddy (estática) |
| `X-Frame-Options` | `DENY` (legacy; el moderno es `frame-ancestors` en CSP; setear ambos no molesta) | Caddy |
| `X-Content-Type-Options` | `nosniff` | Caddy |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Caddy |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` — ojo con `payment` si Bricks usa Payment Request API | Caddy |
| `-Server` / `-X-Powered-By` | Suprimir | Caddy + `poweredByHeader: false` |

Caddy NO agrega headers de seguridad solo — declararlos con `header` en snippet reutilizable.

**CSP con nonces — el trade-off que las guías omiten:** nonces ⇒ todas las páginas pasan a dynamic rendering (se pierde estático/ISR/PPR). Opciones: (1) **CSP sin nonce** en `next.config` `headers()`: `script-src 'self'` + `style-src 'self' 'unsafe-inline'` — mantiene estático, compromiso aceptado (evitar `unsafe-inline` en scripts); (2) SRI experimental — no apostar producción; (3) nonces solo en checkout/admin vía matcher. **Recomendación: opción 1 al salir**, nonces en checkout/admin si un pentest lo pide. La CSP debe permitir MP Bricks (`https://sdk.mercadopago.com`, `api.mercadopago.com`, frames de mercadopago/mercadolibre) en `script-src`/`frame-src`/`connect-src` — verificar lista exacta contra la doc de Bricks. Probar con `Content-Security-Policy-Report-Only` primero.

**Regla de reparto:** Caddy = todo lo estático e igual para todas las respuestas. Next = la CSP. Un solo dueño por header.

Fuentes: https://nextjs.org/docs/app/guides/content-security-policy · https://caddyserver.com/docs/caddyfile/directives/header · https://showdns.net/guides/security-headers-caddy · https://0xdbe.github.io/NextJS-Crafting-CSP/

## 3. Hardening del VPS + Docker

### VPS
1. SSH solo llaves (`PasswordAuthentication no`, `PermitRootLogin no`), usuario sudo no-root.
2. UFW default deny; solo 22/80/443. **Gotcha crítico: Docker escribe iptables y bypasea UFW** — un `ports: "5432:5432"` queda expuesto aunque UFW lo "bloquee". Mitigación: no publicar puertos innecesarios, bindear a `127.0.0.1:`, o fix `ufw-docker` ([repo](https://github.com/chaifeng/ufw-docker)).
3. fail2ban para SSH (o CrowdSec con bouncer para Caddy).
4. unattended-upgrades; imágenes Docker con tags versionados (no `latest` flotante).
5. Solo 80/443 públicos (Caddy).

### Docker / Compose ([OWASP Docker Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html))
- Next.js como **usuario no-root** (`USER node` con output standalone). Postgres oficial ya corre como `postgres`.
- `security_opt: [no-new-privileges:true]`; `cap_drop: [ALL]` + solo lo necesario; `read_only: true` + tmpfs donde sea viable.
- **Postgres SIN `ports:`** — solo red interna; la app llega por `postgres:5432`. Elimina de raíz el problema Docker-vs-UFW. **Dos redes**: `web` (Caddy↔Next) y `db` (Next↔Postgres); Caddy no ve a Postgres.
- No montar `docker.sock`; no `--privileged`; imágenes mínimas; escaneo Trivy/Scout en CI (deseable).
- Postgres con password fuerte + `scram-sha-256`.

## 4. Rate limiting y anti-abuso

- **Caddy (borde):** módulo [`mholt/caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit) (requiere xcaddy) — límite grueso global (ej. 100 req/min/IP).
- **Next (aplicación):** límites finos por semántica: creación de órdenes (5/min/IP), login admin (5/15min con lockout). Single-instance: limiter en memoria LRU alcanza; con réplicas → Redis/Postgres.
- **Webhook de pagos: NO rate limiting agresivo** (retries legítimos en ráfaga); se protege por firma, no por IP.
- **Anti-bot checkout sin CAPTCHA invasivo** (riesgo real: card testing): (1) honeypot field, (2) rate limit por IP en órdenes, (3) validaciones de coherencia (tiempos de submit imposibles), (4) **Cloudflare Turnstile solo si aparece abuso real**, (5) MP ya aporta antifraude propio.

## 5. Webhooks de pago seguros — patrón general

1. **Firma HMAC sobre el RAW body** (error #1 de la industria: verificar sobre el body parseado): `await req.text()` → verificar → `JSON.parse`. Comparación timing-safe. Falla → 401.
2. **La firma no reemplaza la verificación del hecho:** re-consultar la API del PSP por el payment ID; confiar en esa respuesta, no en el payload.
3. **Idempotencia obligatoria** (at-least-once): tabla `webhook_events` con UNIQUE por event/payment ID; duplicado → 200 sin mutar. Previene doble fulfillment/mail/stock.
4. **2xx rápido (<5s), procesar async**: persistir, encolar lo pesado (mails), devolver 200.

Extras: loguear eventos con resultado de verificación; nunca el payload completo si trae PII.

Fuentes: https://www.hooklistener.com/learn/webhooks-fundamentals · https://webflow.com/blog/webhook-security · https://apidog.com/blog/payment-webhook-best-practices/

## 6. Secretos y datos

- **Compose `secrets:`** para `POSTGRES_PASSWORD` (la imagen soporta `POSTGRES_PASSWORD_FILE`) y el access token de MP — los saca de `docker inspect`/environment. `.env` con permisos 600 fuera del repo para lo no sensible. `NEXT_PUBLIC_*` solo valores públicos (public key de MP sí; access token JAMÁS — solo lo lee el server).
- **Nunca loguear** ([OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)): tokens, session IDs, passwords, `Authorization`, cuerpos de webhooks, PII innecesaria. Sí loguear: logins fallidos, firmas inválidas, 429s — con timestamp e IP.
- **Backups:** `pg_dump -Fc` vía `docker exec` desde cron + **restic** off-site (cifra AES-256 client-side, dedup); la clave NO vive en el mismo VPS. Retención 7d/4w/6-12m. Verificar **restaurando** (conteo de filas), no por existencia.
- **Ley 25.326 (Argentina):** inscripción en el RNBD ante la AAIP (TAD; formal, iniciarlo temprano); política de privacidad + aviso en checkout; derechos de acceso/rectificación/supresión (canal de contacto + capacidad real de borrar/exportar); minimización (solo datos de venta/envío); sin datos sensibles; no almacenar tarjetas (SAQ A ya lo garantiza). Texto: https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm

## 7. Checklist priorizado

### Imprescindible para producción
**Aplicación:** Next ≥ 15.2.3 + `npm audit` + lockfile · auth/authz en cada Action y Handler (no solo middleware) + ownership en órdenes · Zod en todo input + total recalculado server-side · sin `$queryRawUnsafe` (lint) · sin `dangerouslySetInnerHTML` sin sanitizar · `allowedOrigins`/`X-Forwarded-Host` verificado tras Caddy · secrets solo server-side, DAL único lector de `process.env`.
**Webhook:** firma sobre raw body timing-safe + re-consulta API antes de marcar pagada · idempotencia UNIQUE + 200 rápido + async · estado de orden enum con transición atómica + stock atómico.
**Infra:** SSH llaves/no-root · UFW deny + solo 22/80/443 · Postgres sin puerto publicado, verificado desde afuera con `nmap` (bypass Docker-UFW) · contenedores no-root + `no-new-privileges` · secrets Compose para DB y MP · headers en Caddy + CSP sin nonce con dominios MP probada en Report-Only · unattended-upgrades + fail2ban · backup diario cifrado off-site + **una restauración de prueba verificada** · rate limit en órdenes + honeypot · logs sin PII · política de privacidad publicada.

### Deseable después
RNBD/AAIP (iniciar temprano) · CSP con nonces en checkout/admin · caddy-ratelimit · CrowdSec · Turnstile solo con abuso real · read_only + Trivy en CI · taint API · admin: lockout + SameSite=Strict + 2FA TOTP + IP-restrict en Caddy · monitoreo/alertas + Renovate · ZAP contra staging.

---

# Informe 3 — SEO (migración WordPress → Next.js, mismo dominio)

**Decisión estratégica que condiciona todo:** con ~90 productos, **conservar la estructura de URLs** (`/producto/{slug}`, `/categoria-producto/{slug}`) es la opción de menor riesgo — cada URL idéntica no necesita redirect ni pierde señales. ~60% de las migraciones pierden tráfico (estudio Ahrefs 2025); la causa dominante: redirects rotos, contenido eliminado, cambios de estructura innecesarios.

## 1. SEO técnico en App Router

- **`generateMetadata({ params })`** en PDPs/categorías; los `fetch` adentro se memoizan con los del Page (con Prisma usar `React.cache()`).
- **`metadataBase` obligatorio** en `app/layout.tsx` (`new URL('https://rodak.ar')`).
- **Canonical:** `alternates: { canonical }` por página. Filtros (`?orden=precio`) → canonical a la versión limpia; paginación → **self-canonical** (no a página 1).
- **Títulos:** `title: { template: '%s | Rodak', default: ... }`. La metadata mergea shallow — un `openGraph` parcial en una página REEMPLAZA el del layout (cuidado con perder `og:image`).
- **`app/sitemap.ts`** desde Prisma con `lastModified` REAL (no `new Date()` por build — Google lo ignora si es falso). **`app/robots.ts`**: bloquear `/api/`, `/carrito`, `/checkout`, admin; NO bloquear URLs con parámetros si se manejan con canonicals. Redirigir 301 el sitemap viejo de Yoast (`sitemap_index.xml`) a `/sitemap.xml`.
- **Trailing slash:** URLs de WP terminan en `/`. **`trailingSlash: true` = las URLs viejas resuelven sin ningún redirect** (cero hops). Default (sin slash) mete un 308 a TODAS las URLs indexadas. El canonical debe coincidir exactamente con la variante elegida.
- **SSR:** el crawler recibe HTML completo en la primera respuesta — sin depender de la cola de rendering JS de Googlebot. Prerender de las 90 PDPs (SSG/ISR).

Fuentes: https://nextjs.org/docs/app/api-reference/functions/generate-metadata · https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap · https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash · https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

## 2. Datos estructurados (JSON-LD)

**Objetivo: merchant listings** (páginas donde se compra) — habilita precio/disponibilidad/envío en resultados.

**Product + Offer requeridos:** `name` · `image` (varias, min 50K píxeles, ratios 16:9/4:3/1:1) · `offers.price` **formato máquina** `"185000.00"` (punto decimal, sin miles ni símbolo) · `offers.priceCurrency: "ARS"`.
**Recomendados:** `availability` (mapeado desde stock real en Postgres) · `itemCondition` · `priceValidUntil` · `shippingDetails` · `hasMerchantReturnPolicy` · `sku` · `brand.name: "Rodak"` · `description`. **`aggregateRating`/`review` SOLO con reseñas reales** — inventarlas puede derivar en acción manual de Google.

Implementación: componente servidor con `<script type="application/ld+json">` y `JSON.stringify(data).replace(/</g, '\\u003c')` (sanitización que la doc de Next recomienda), alimentado por la misma query memoizada.

**BreadcrumbList** en PDPs y categorías. **Categorías = `ItemList`** de `ListItem` apuntando a las PDPs visibles en esa página (con paginación, cada página su ItemList) — NO Product completo en categorías. **`FurnitureStore`** (subtipo de LocalBusiness) en la página del showroom: `name` + `address` requeridos; `geo`, `openingHoursSpecification`, `telephone` +54, `priceRange` recomendados; NAP idéntico al Google Business Profile.

Validadores: https://search.google.com/test/rich-results · https://validator.schema.org · post-launch: GSC "Merchant listings".

Fuentes: https://developers.google.com/search/docs/appearance/structured-data/product · /merchant-listing · /carousel · /breadcrumb · /local-business · /sd-policies

## 3. Migración sin perder ranking

1. **Inventario completo** antes de apagar WP: sitemap Yoast + GSC (indexadas + rendimiento) + analytics + crawl (Screaming Frog / `wget --spider`). Export de la DB de WooCommerce (slugs).
2. **Mapa 1:1**: cada URL vieja → equivalente exacto. Con 90 productos entra en `redirects()` de `next.config` (hasta ~1000 sin problema). Cubrir: productos, categorías (+ paginación `/page/2/`), `/tienda/`, `/carrito/`, `/finalizar-compra/`, shortlinks `?p=123`, tags, feeds, `/wp-json/` → equivalente o **410**.
3. **Huérfanas:** redirect a categoría cercana solo si es relevante; si no, 404/410 honesto. **Nunca todo a la home** (soft 404 — descarta señales).
4. **Imágenes de `/wp-content/uploads/` indexadas**: (a) seguir sirviéndolas en la misma ruta desde el server nuevo (rewrite estática — cero pérdida), o (b) 301 por imagen. Dejarlas 404ear tira Google Images y embeds. Es el hueco que nadie planifica.

**Reglas oficiales Google** ([site move](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes), [redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects)): 301/308 server-side (no meta refresh/JS); los permanentes **no pierden PageRank**; cadenas ≤3 hops (colapsar http→https→slash en la capa más externa); **mantener ≥1 año** (para 90 productos: indefinidamente); migrar todo simultáneamente; **Change of Address NO se usa** (solo cambios de dominio); enviar sitemap nuevo inmediato + mantener temporalmente el viejo accesible.

**Errores documentados:** noindex de staging en producción (el clásico #1) · redirect masivo a home · mapa incompleto (imágenes/paginación/tags) · cadenas de 3+ · cambiar URLs+contenido+titles a la vez (portar los de Yoast tal cual al arranque; optimizar después como cambio separado) · server subdimensionado para el pico de recrawl.

**Fluctuación esperada:** semanas; pánico solo con caída sostenida a las 4-6 semanas con redirects verificados.

## 4. Core Web Vitals

| Métrica | Bueno | Pobre |
|---|---|---|
| LCP | ≤ 2,5s | > 4,0s |
| INP | ≤ 200ms | > 500ms |
| CLS | ≤ 0,1 | > 0,25 |

Impacto en ranking: factor **liviano, de desempate** según Google — desconfiar de cifras infladas de blogs. Donde pega fuerte es en **conversión** (>50% de usuarios móviles abandona >3s).

Técnicas Next: `next/image` con **`preload`** (renombre de `priority` en Next 16) en hero/PDP + `sizes` en grilla + celdas con aspect-ratio fijo (CLS) · `next/font` (fallback con `size-adjust` → CLS fuentes ≈ 0) · Server Components con islas cliente puntuales (INP) · **self-hosted: cachear la salida del optimizador de imágenes** — en un VPS chico puede ser el cuello de botella del LCP · medir con `next build && next start` + Lighthouse (nunca dev) + CrUX/PSI de campo.

Fuentes: https://developers.google.com/search/docs/appearance/core-web-vitals · https://web.dev/articles/vitals · https://nextjs.org/docs/app/api-reference/components/image

## 5. SEO local Argentina

- **hreflang NO hace falta** (un idioma, un país — Mueller lo confirmó). Sí: `<html lang="es">` y `og:locale: 'es_AR'`.
- **Google Business Profile** para el showroom = palanca #1 del SEO local; NAP idéntico al JSON-LD `FurnitureStore`; pedir reseñas reales.
- UI: `Intl.NumberFormat('es-AR')` → "$ 185.000,00"; JSON-LD: formato máquina.
- Post-launch opcional: Google Merchant Center con listados gratuitos (disponible en AR).

## 6. Checklist priorizado

**En el build (Fases 0-2, se diseña desde el día uno):** decisión de URLs + trailing slash ANTES de la primera ruta · `metadataBase` + template de títulos · `generateMetadata` en PDP/categoría (portando metadatos de Yoast) · JSON-LD Product/Offer + Breadcrumb + ItemList + Organization · `sitemap.ts`/`robots.ts` · `next/image` preload + sizes + aspect-ratio · `next/font` · **staging con noindex/auth + checklist para sacarlo** · inventario de URLs viejas y mapa 301 (se puede empezar ya).

**Semana del cutover (Fase 6):** crawl final + export GSC + congelar mapa · script que recorra TODAS las URLs del inventario verificando status + destino en un hop · resolución de wp-content definida · Rich Results Test en staging · día D: verificar noindex FUERA + re-correr script + enviar sitemap + URL Inspection en principales · +30 días: monitoreo diario de 404s/GSC/posiciones.

**Después sin riesgo:** reviews + aggregateRating · shippingDetails refinados · Merchant Center · optimización de copy separada · blog · fine-tuning INP.
