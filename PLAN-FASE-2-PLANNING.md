# Plan — Sesión de planning SDD de la Fase 2 (fase-2-pdp)

**Rev 2 (24/07/2026):** incorpora los 6 cambios del veredicto de Codex
(`CODEX-REVIEW-VEREDICTO.md`, APROBAR CON CAMBIOS). Rev 1 aprobada por Facu.

## Contexto

Fases 0 y 1 cerradas y archivadas: staging vivo en rodak.fromdevdiego.com con el
catálogo real (88 productos, 272 variantes, 21 categorías, 317 imágenes) y los
placeholders del seed eliminados (PR #22 mergeado). El siguiente hito del
PLAN-MAESTRO es la **Fase 2 — Catálogo y PDP rico**. Esta sesión corre SOLO el
planning SDD; el apply lo ejecuta Facu en otra sesión con Opus, igual que en la
Fase 1. Persistencia SDD: engram (no hay openspec/ en el repo), topic keys
`sdd/fase-2-pdp/{type}`.

**Decisiones de Facu ya tomadas (no re-preguntar):**
- Alcance: TODO el scope del PLAN-MAESTRO en un solo ciclo SDD — home, grilla de
  categoría, búsqueda, PDP (galería, selector material/medida, tabs), reviews
  propias (modelo + UI), tags BEST SELLER/NEW.
- Tema visual: **claro editorial según `.impeccable.md`** (off-white cálido,
  tinta carbón, acento dorado 60-30-10). Los mockups de `mockups/` aportan
  layout/estructura/componentes pero su paleta oscura NO manda; el toggle
  oscuro puede diferirse.

## Qué se ejecuta (pipeline SDD con gates) — [Codex #9: secuencia corregida]

La secuencia vinculante es `explore → proposal → GATE → spec → design → GATE →
tasks`. La fase de tasks NO se invoca hasta que el design tenga aprobación
registrada de Facu.

1. **`sdd-new fase-2-pdp`** → explore + proposal.
   - **GATE 1: Facu aprueba el proposal.** La sesión se detiene hasta el ok.
2. **`sdd-continue`** → spec → design. **La sesión se DETIENE tras el design.**
   - **GATE 2: Facu aprueba el design** (en Fase 1 el design necesitó rev2 —
     esperar correcciones es lo normal, no la excepción).
3. **`sdd-continue`** → tasks (solo con el design aprobado).
   - Las tasks se escriben para un ejecutor Opus SIN memoria de conversación:
     ver "Contrato de autosuficiencia de las tasks" abajo.
4. Cierre: gate documental de trazabilidad (ver "Verificación"), actualizar
   `tasks/todo.md`, memoria engram, resumen.

Cada fase corre como sub-agente (`.claude/agents/sdd-*`) según los comandos de
`.claude/commands/sdd-*.md`. Artefactos técnicos en inglés (contrato de idioma).

## Matriz de alcance por superficie — [Codex #1/#12]

Disposición por bloque de los mockups. `INCLUIR` = se construye en Fase 2;
`EXCLUIR` = no existe en Fase 2 (ni siquiera inerte: un control muerto no es
aceptable); `REEMPLAZAR` = el bloque existe pero con otro contenido. Esta
matriz es la propuesta que el proposal formaliza (GATE 1 puede ajustarla).

**`mockups/index.html` (home):**
| Bloque | Disposición |
|---|---|
| Announce bar | INCLUIR |
| Nav sticky + wordmark | INCLUIR — **sin** cart pill (Fase 4) y **sin** links a Bundles/checkout (Fases 3/4) |
| Theme toggle | EXCLUIR (base clara única; toggle diferido) |
| Hero | INCLUIR |
| Sección `#sistema` (discurso de bundles) | EXCLUIR (Fase 3) |
| Grid `#productos` | INCLUIR (alimentado por el catálogo real) |
| Producto "Bundle" + configurador + CTA "Agregar combo al carrito" | EXCLUIR (Fase 3/4) |
| PDP teaser | REEMPLAZAR por destacados/tags (BEST SELLER/NEW) |
| Trust row | INCLUIR |
| Newsletter | EXCLUIR (sin backend de captura; un form muerto es peor que nada) |

**`mockups/producto.html` (PDP):**
| Bloque | Disposición |
|---|---|
| Galería (thumbs + stage + zoom) | INCLUIR — zoom simple (Baymard: overlays complejos fallan) |
| Eyebrow categoría, h1, subtítulo, bullets | INCLUIR |
| Rating line | INCLUIR — con reviews reales APPROVED; empty state si no hay |
| Priceblock now/was/badge | INCLUIR — `salePriceCents`; `priceCents === 0` → "consultar precio" |
| Línea descuento por transferencia | EXCLUIR (pricing de Fase 4) |
| Swatches material (`#mats`) + medidas (`#sizes`) | INCLUIR — incluida la opción "A medida — consultar" |
| Configurador de bundle (`.config`) | EXCLUIR (Fase 3) |
| Qty + add-to-cart + stock line | EXCLUIR qty/cart (Fase 4); disponibilidad INCLUIR leyendo `inStock` |
| Reassurance icons | INCLUIR |
| Tabs (Descripción/Specs/Envío/Reseñas) | INCLUIR — Reseñas con el modelo propio |
| Cross-sell "Combina con tu…" | REEMPLAZAR por "más de esta categoría" (la compatibilidad curada es Fase 3) |

**`mockups/checkout.html`:** EXCLUIR entero (Fase 4).

**Fuera de Fase 2 en todos los casos:** bundles, compatibilidad curada,
cantidad, carrito, checkout, panel de moderación (Fase 5), SEO/go-live (Fase 6).

## Insumos que las fases SDD deben recibir

**Restricciones duras de datos/UI:**
- `priceCents === 0` (7 variantes "A medida (consultar)") DEBE renderizar
  "consultar precio", jamás $0/"gratis". Lista exacta en
  `data/woo-snapshot/reconciliation-report.json`.
- Disponibilidad se lee de `inStock`, NUNCA de `stock` (0 = desconocido, no
  "sin stock") — invariante documentada en `prisma/schema.prisma`.
- Plata en centavos enteros; `formatPriceCents` ya existe en `src/lib/format.ts`
  (es-AR, ARS, pinned para evitar hydration mismatch).
- [Codex #3] `material` y `sizeMm` son **strings libres**, no enums — los
  selectores se derivan de los datos, no de una matriz rígida. Timestamps en
  `timestamptz` (Review debe seguir la convención). `slug`/`sku` son las claves
  de upsert del import; `wooId` es provenance-only — los cambios aditivos no
  pueden alterar identidad ni importabilidad. `trailingSlash: true` en
  `next.config.ts`: TODAS las URLs y links internos llevan barra final.

**Contrato del data layer — [Codex #2/#4]:**
- Hoy solo `getProductsForListing()`, cuyo DTO expone `stock` y omite
  `inStock`/`salePriceCents`: **contradice la invariante** — la task debe
  ordenar su reemplazo explícito, no "extenderlo". Prohibido exponer `stock`
  en DTOs de UI.
- Nuevas funciones (producto-por-slug, listado por categoría, búsqueda) con
  contrato explícito: "no existe" ≠ "DB falló" (null vs excepción propagada),
  orden estable y determinista, paginación definida, DTOs planos (jamás
  instancias Prisma hacia Client Components). Mantener `server-only` +
  `prisma` lazy de `src/lib/db.ts` (import sin side-effects).
- Tests obligatorios del DTO: `stock=0 ∧ inStock=true`, `stock=0 ∧
  inStock=false`, precio promocional, `priceCents=0`.

**Estado actual del frontend (arranca de cero):**
- Sin CSS, sin Tailwind, sin componentes, sin fuentes, sin public/. Solo
  `layout.tsx` mínimo, `(shop)/page.tsx` (lista `<ul>` bare), `error.tsx`.
- Tipografías de `.impeccable.md`: Bricolage Grotesque (display) + Hanken
  Grotesk (body). Tokens OKLCH liftables de los mockups (invirtiendo a claro).

**Schema (cambios solo aditivos) — Review con ciclo de vida [Codex #7]:**
- Modelo `Review`: rating 1-5 con **CHECK real en la migración SQL** (Prisma no
  lo expresa con `Int` solo), title, body, autor nombre + email, enum
  `ReviewStatus PENDING/APPROVED/REJECTED` con **default PENDING**, timestamps
  `timestamptz`, FK a Product con regla de borrado explícita.
- **El email JAMÁS sale en el DTO público.**
- Decisión a cerrar en el proposal (GATE 1): ¿Fase 2 permite ENVIAR reviews o
  solo LEE las APPROVED? Si permite envío: validación server-side, límites de
  longitud, rate limiting/anti-abuso, estados de éxito/error. Si solo lee:
  empty state + mecanismo explícito para aprobar reviews sin el panel de Fase 5
  (p.ej. SQL manual documentado). La UI solo renderiza APPROVED en cualquier
  caso.
- Tags BEST SELLER/NEW: mecanismo aditivo (campo o tabla) sin tocar identidad.
- `Category` no tiene jerarquía/imagen/orden → schema aditivo o datos
  derivados (decisión para sdd-design).

**Render/caching: decisión de TRES vértices — [Codex #5]:**
El conflicto no es solo force-dynamic vs ISR; el tercer vértice es que **`next
build` corre SIN DB en CI** (contrato del repo). El design debe elegir un
patrón que preserve los tres, p.ej.: shell estático + consulta diferida a
request con `Suspense`/`connection()` y caché runtime (`use cache` /
cacheComponents), O cambiar explícitamente el contrato de CI para tener DB en
build. Prohibido mezclar ISR clásico con cacheComponents. Healthcheck:
`/api/health` con consulta barata a DB, NO cacheada, non-2xx ante fallo; se
despliega ANTES de cambiar la config de Coolify (paso manual de Facu,
documentado como task). Criterios de aceptación obligatorios: `npm run build`
sin DB pasa; health responde bien con DB viva y non-2xx con DB caída; headers
de caché reales verificados; comportamiento tras reinicio/revalidación probado.

**Imágenes: contrato corregido — [Codex #6]:**
- Sin dimensiones en `ProductMedia` ⇒ cada imagen usa `width`+`height`
  conocidos **o** `fill` — y con `fill`, `sizes` es **OBLIGATORIO** (si no, el
  browser asume 100vw y baja variantes sobredimensionadas) y el contenedor
  reserva geometría (aspect-ratio, sin CLS).
- LCP: en Next 16 se usa **`preload`** (la prop `priority` está deprecada) y
  SOLO en la imagen LCP (hero / primera del PDP); el resto lazy.
- Las tasks fijan contrato POR SLOT: hero, primera imagen de PDP, thumbnails,
  cards de grilla — cada uno con `sizes`, aspect ratio, `alt` y preload sí/no.
- Hotlink a rodak.ar ya permitido en `next.config.ts` (solo
  `rodak.ar/wp-content/uploads/**`). Rehosteo es deuda aparte, NO Fase 2.

**Búsqueda: contrato observable ANTES que tecnología — [Codex #8]:**
- El spec define primero el contrato: campos buscados, normalización de
  acentos/mayúsculas, largo mín/máx de query, tolerancia a typos deseada,
  ranking/orden, paginación, query vacía, tiempo objetivo. sdd-design elige la
  solución MÁS SIMPLE que lo cumpla (a 88 productos un `ILIKE`/trigram sobre
  name+description probablemente alcanza; FTS+`unaccent`+`pg_trgm` NO es
  requisito por defecto).
- Si se eligen extensiones: migración SQL aditiva (`CREATE EXTENSION IF NOT
  EXISTS`), verificar disponibilidad en el Postgres objetivo (Coolify
  postgres:18-alpine), índice compatible, consultas parametrizadas, prueba de
  rollback/drift (`db:check-drift` debe seguir pasando).

**Testing:**
- vitest es node-only y el glob NO matchea `.test.tsx` → para tests de
  componentes hay que sumar jsdom/@testing-library/react + @vitejs/plugin-react
  y ampliar el include (decisión para sdd-design/tasks).
- Regla del proyecto: el gate de cierre es el run real (browser/dispositivo),
  no solo tests. Hito del PLAN-MAESTRO: home → categoría → producto navegable
  y responsive en dispositivo real.

**Otras reglas del repo que las tasks deben respetar:**
- Prohibido crear `middleware.ts` (hook PreToolUse lo bloquea; Next 16 usa
  `proxy.ts` y solo para headers).
- Objetivo performance: pocos scripts (referencia balolo: 18, no 78).
- Entrega en PRs encadenados con review gentle-ai (patrón Fase 1); un receipt =
  un commit.
- Front valida usabilidad, no seguridad.

## Tabla de decisiones técnicas exigida a sdd-design — [Codex #13]

El design DEBE incluir una tabla con una fila por decisión, cada una con:
decisión tomada, alternativa descartada, consecuencia, task responsable y
verificación observable (comando/output). Filas mínimas:
1. Estrategia de render/caché + build sin DB (los tres vértices).
2. Contrato de `/api/health` y secuencia de cambio en Coolify.
3. Ciclo de vida de Review (lectura vs escritura, aprobación sin panel).
4. Búsqueda (contrato observable → tecnología elegida).
5. DTOs y paginación del data layer.
6. Estrategia de imágenes por slot.

## Contrato de autosuficiencia de las tasks — [Codex #11]

- Cada task referencia los IDs de engram del spec y design APROBADOS y repite
  las invariantes que necesita (no asume que el ejecutor las conoce).
- Cada task declara: precondiciones, archivos permitidos, dependencias con
  otras tasks, comportamiento esperado, casos de error, pruebas, verificación
  manual si aplica, y qué queda explícitamente FUERA.
- Si una decisión necesaria vive solo en conversación/explore/design y no en
  las tasks, el handoff está roto: se corrige antes de cerrar.

## Insumos de investigación web (24/07/2026 — verificar contra fuentes primarias antes de fijar en spec [Codex #10])

- **Next 16**: `cacheComponents` + `use cache` + PPR (shell estático + huecos
  dinámicos en Suspense); cachear a nivel componente; ISR clásico sigue
  disponible con cacheComponents deshabilitado; `priority` → `preload` en
  next/image. Verificar contra nextjs.org/docs antes del spec.
- **Baymard (PDP)**: selectores de variante como botones expuestos, nunca
  dropdowns; 3+ imágenes; zoom/overlay simple; ~62% de sitios líderes con PDP
  mediocre.
- **Búsqueda**: Postgres solo alcanza de sobra a esta escala; Algolia/Elastic
  se justifica recién con facetas agregadas complejas.
- **Reviews**: rating con constraint, moderación como estado explícito,
  unicidad/verified-purchase diferidos a Fase 4 (no hay usuarios ni órdenes).
- **Vercel Commerce**: RSC + Server Actions + `loading.tsx` con skeletons;
  home como shell con grids en Suspense anidado.

Fuentes: [Next.js 16 cache components](https://shubhra.dev/tutorials/nextjs-16-cache-components), [PPR oficial](https://nextjs.org/docs/app/getting-started/partial-prerendering), [connection()](https://nextjs.org/docs/app/api-reference/functions/connection), [next/image](https://nextjs.org/docs/app/api-reference/components/image), [Baymard product page UX](https://baymard.com/blog/current-state-ecommerce-product-page-ux), [Postgres FTS vs the rest](https://supabase.com/blog/postgres-full-text-search-vs-the-rest), [Prisma extensions](https://docs.prisma.io/docs/postgres/database/postgres-extensions), [Next.js Commerce](https://github.com/vercel/commerce).

## Verificación (de esta sesión de planning) — [Codex #10/#14: ampliada]

- Artefactos en engram: `sdd/fase-2-pdp/explore`, `/proposal`, `/spec`,
  `/design`, `/tasks` (IDs anotados).
- Gates de Facu pasados EN ORDEN: proposal aprobado ANTES del spec; design
  aprobado ANTES de las tasks.
- **Gate documental de trazabilidad antes del cierre:**
  - Matriz `requisito → task → evidencia` que cubra TAMBIÉN los requisitos
    negativos: `priceCents=0` nunca "gratis"; `stock` nunca decide
    disponibilidad; nada de Fases 3-6; `next build` sin DB; email de review
    nunca público.
  - Consistencia proposal ↔ spec ↔ design ↔ tasks (ninguna decisión abierta
    sin resolver, ninguna contradicción).
  - Claims de investigación web validados contra fuente primaria (nextjs.org,
    docs de Prisma) antes de quedar fijos en el spec.
  - Dependencias y orden de ejecución de las tasks explícitos.
  - Lectura final simulando al ejecutor Opus sin memoria: ¿puede ejecutar cada
    task sin este chat? Si no, se corrige la task.
- `tasks/todo.md` actualizado con el estado y el próximo paso (apply con Opus).
