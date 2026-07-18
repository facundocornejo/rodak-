# Decisiones de arquitectura — Tienda nueva Rodak

**Fecha:** 2026-07-18
**Base:** hallazgos de `AUDITORIA.md` + investigación de integración Mercado Pago.
**Estado:** propuesta para revisión. Cada decisión trae la alternativa descartada y el porqué.

> Convención del proyecto: plata en **centavos (enteros)**, fechas **UTC en storage**, decrementos de stock **atómicos en la DB**, operaciones irreversibles con flag persistido **antes** del submit. Estas reglas se aplican transversalmente a todo lo de abajo.

---

## 1. ¿Reconstruir custom, renovar el WooCommerce, o usar una plataforma?

Esta es LA decisión que condiciona todas las demás. Comparación honesta en `PLAN-MAESTRO.md §Viabilidad`. **Recomendación: desarrollo custom en el VPS**, porque el mecanismo de bundles modulares (el corazón del proyecto) es incómodo de lograr bien en WooCommerce sin apilar plugins, y una plataforma cerrada (Shopify/Tiendanube) cobra fee por venta sobre tickets altos y limita el configurador a apps de terceros.

**Alternativa descartada (WooCommerce renovado):** técnicamente posible con plugins de "composite products" / "product bundles", pero se hereda el stack pesado, la mantención de 14 plugins y la fragilidad de updates. Se descarta para la versión objetivo, PERO se mantiene vivo como *plan B de bajo esfuerzo* (ver PLAN-MAESTRO).

---

## 2. Stack técnico

| Capa | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| Framework | **Next.js (App Router) + React** | Astro; WordPress headless | SSR/SSG para SEO de catálogo, ecosistema de e-commerce maduro, SDK oficial de MP para React (`@mercadopago/sdk-react`). Astro es más liviano pero el configurador de bundles es muy interactivo (React encaja mejor). |
| Backend | **Node en el mismo Next.js (Route Handlers) o Node/Express separado** | PHP; serverless puro | El Access Token de MP y los webhooks necesitan servidor de confianza; el VPS ya está. Empezar monolito Next.js y separar solo si hace falta. |
| Base de datos | **PostgreSQL** | MySQL; MongoDB | Relacional encaja con catálogo/variantes/órdenes; transacciones sólidas para stock y pagos. Postgres > MySQL por integridad y tipos. Mongo se descarta: el dominio es relacional (producto↔variante↔accesorio↔orden). |
| ORM | **Prisma** (o Drizzle) | SQL a mano | Migraciones versionadas y tipos. *(Regla dura: nunca editar migraciones ya aplicadas.)* |
| Hosting | **VPS Linux propio** (ya disponible) | PaaS (Vercel) | Ya está pago; control total; el backend de MP y jobs de stock viven cómodos. Vercel complica webhooks/cron con estado. |
| Deploy | **Docker + reverse proxy (Caddy/Nginx) + Postgres en el VPS** | Deploy manual | Reproducible; Caddy da HTTPS automático (necesario para MP producción). |
| Imágenes | **Optimización en build/CDN** (next/image + Cloudflare gratis delante) | Servir originales | Balolo usa Cloudflare; el peso de imagen es crítico en un catálogo de muebles fotografiados. |

---

## 3. Modelo de datos (el núcleo — habilita el mecanismo balolo)

El modelo tiene que expresar **"este accesorio es compatible con este mueble"** y **"este bundle agrupa estos productos con un precio con descuento"**. Bosquejo:

```
Product            (id, slug, title, description, product_type, base_material_group, is_foundation, active)
ProductVariant     (id, product_id, sku, material, size, price_cents, stock, stock_reserved)
ProductMedia       (id, product_id, url, alt, position)
Category           (id, slug, title)  +  ProductCategory (M:N)

# --- lo que habilita el configurador ---
Accessory Compatibility:
CompatibleAccessory (foundation_product_id, accessory_product_id, position)
   → "el Escritorio Brent admite: soporte auricular, bandeja teclado, elevación monitor..."

Bundle             (id, slug, title, discount_pct, active)
BundleItem         (bundle_id, product_variant_id, qty)
   → bundle pre-armado con precio = suma - discount_pct, mostrando precio tachado

Review             (id, product_id, rating, author, body, verified, created_at)  # reviews propias desde día 1
```

**Decisión clave:** las variantes tienen **dos ejes** — `material` (Paraíso/Cedro/Negro…) y `size` (medida en mm). Rodak ya piensa en maderas y medidas, así que mapea natural. El **precio va en centavos** (`price_cents INT`), nunca float.

**Alternativa descartada (accesorios como "productos relacionados" libres):** es lo que hace hoy WooCommerce y no sirve — no distingue "accesorio compatible" de "producto de la misma categoría". La tabla `CompatibleAccessory` explícita es lo que permite el configurador curado.

---

## 4. Pagos

> Detalle técnico completo en el informe de MP (resumido acá). **Advertencia:** los porcentajes de comisión NO se pudieron verificar contra fuente oficial (la ayuda de MP bloquea scraping) — **confirmar en el panel "Costos y cuotas" de la cuenta real antes de fijar precios**; además varían por provincia.

### 4.1 Mercado Pago — Checkout Bricks (no Checkout Pro)
**Decisión:** integrar **Checkout Bricks (Payment Brick)** con backend propio en Node.

| Criterio | Bricks (elegido) | Checkout Pro (descartado como primario) |
|---|---|---|
| UX | Embebido en tu dominio, con tu marca | Redirect a mercadopago.com |
| PCI | SAQ A (la tarjeta se tokeniza en campos de MP) | SAQ A (igual) |
| Tickets altos | La confianza del dominio propio importa | El redirect rompe la experiencia |
| Esfuerzo | Medio (semanas) | Bajo (días) |

Checkout Pro queda como **fallback** si hay que salir a producción rápido. Se descarta el Checkout API "a mano" (mismo resultado, más esfuerzo, peor PCI: SAQ D).

### 4.2 Cuotas — CORRECCIÓN IMPORTANTE
**Cuota Simple (ex Ahora 12) ya no existe** — el programa terminó en junio 2025 y la normativa se derogó en junio 2026. El PDP actual de rodak la sigue publicitando: **hay que corregir ese texto**. Hoy solo existen:
- **Cuotas con interés** (las paga el comprador; el vendedor cobra neto).
- **Cuotas sin interés absorbidas por el vendedor** (se activan en el panel; el vendedor paga el costo de financiación, ~4,5% a 3 cuotas / ~7% a 6 / ~12% a 12, *sin verificar*).

Para muebles de ticket alto, absorber cuotas es caro → **modelar precio "con transferencia" vs "financiado"** en vez de comerse 6 cuotas sin interés.

### 4.3 Transferencia bancaria — estado explícito + reserva con expiración
**Decisión:** medio de pago de primera clase (Rodak ya da 10% off por transferencia). Patrón:
1. Orden nace en estado `pending_transfer` (enum, **no** bool — modela la incertidumbre como estado).
2. Post-checkout: mostrar CBU/alias/titular/CUIT + **monto exacto** + nº de orden, en pantalla y por email.
3. **Reserva de stock atómica** (`UPDATE ... WHERE stock >= qty`) con `reservation_expires_at` (48–72h; Tiendanube usa 3 días).
4. Job/cron libera stock y pasa a `expired` al vencer, con aviso previo al cliente.
5. **Confirmación manual** del admin (panel con órdenes `pending_transfer`) → pasa a `paid`, registrando quién/cuándo/referencia. Operación irreversible: validar pre y post.

**Alternativa descartada (transferencia como "nota al pedido" sin estado):** es lo frágil de muchas tiendas — sin reserva de stock se sobrevende, sin expiración las órdenes quedan colgadas. El estado explícito lo previene.

### 4.4 Confirmación de pago (regla de oro)
El estado de la orden se decide **solo server-side** vía webhook + re-consulta a la API. Nunca confiar en el redirect del navegador.
- Webhook topic `payment` → validar firma `x-signature` (HMAC-SHA256) → responder HTTP 200 en <22s → `GET /v1/payments/{id}` → mapear contra `external_reference` (siempre setear el ID de orden propio) → **verificar monto y moneda** antes de marcar `paid`.
- **Idempotencia entrante** (webhooks duplicados/fuera de orden): transiciones de estado monotónicas (`paid` no vuelve a `pending`).
- **Idempotencia saliente** (crear pagos): header `X-Idempotency-Key` (UUID por intento) es **obligatorio**.

---

## 5. Envíos / logística (muebles en AR)

**Decisión:** modelar envío como **cotización por zona/peso volumétrico + retiro en showroom**, no tarifa plana. Muebles = bulto grande, el costo real varía muchísimo.
- Corto plazo: **envío a coordinar** (como hoy) + zonas con costo fijo para AMBA.
- Integración con Correo Argentino / transporte / Andreani se evalúa en fase 2 (APIs de cotización).
- Rodak ya comunica "Envíos a todo el país" → mantener, pero con expectativa clara de plazos por el tipo de producto (algunos son fabricados a pedido: "consultanos por otras medidas").

**Alternativa descartada (tarifa plana nacional):** para muebles subsidia envíos lejanos y encarece los cercanos; irreal para el producto.

---

## 6. Seguridad (cerrar los gaps de la auditoría)

| Ítem | Decisión |
|---|---|
| Security headers | Configurar en el reverse proxy: **HSTS, X-Frame-Options, X-Content-Type-Options: nosniff, CSP, Referrer-Policy, Permissions-Policy** (rodak hoy tiene CERO). |
| Secretos | Access Token de MP y credenciales **solo en env del server**, jamás en el bundle de Next.js ni en el repo. *(Regla dura del proyecto.)* |
| HTTPS | Caddy/Let's Encrypt automático (obligatorio para MP producción). |
| Validación | Siempre en el backend; el front es usabilidad, no seguridad. |
| Superficie | No exponer versiones de framework en headers/HTML. |
| Rate limiting | En el proxy, sobre endpoints de pago y login. |

---

## 7. Backups y datos

- Backups de Postgres **verificados por consistencia** (contar filas restauradas), no por existencia del archivo. *(Regla dura.)*
- Migración de catálogo: exportar los 89 productos + imágenes + categorías desde WooCommerce (CSV/REST API de WC) → transformar al modelo nuevo. Preservar slugs para los redirects 301.

---

## 8. Tabla resumen de decisiones

| # | Área | Decisión | Alternativa descartada |
|---|---|---|---|
| 1 | Enfoque | Custom en VPS | WooCommerce renovado (plan B) / plataforma |
| 2 | Framework | Next.js + React | Astro / WP headless |
| 3 | DB | PostgreSQL + Prisma | MySQL / Mongo |
| 4 | Datos | Modelo con `CompatibleAccessory` + `Bundle` explícitos | "productos relacionados" libres |
| 5 | Checkout | MP Checkout Bricks | Checkout Pro (fallback) / API a mano |
| 6 | Cuotas | Precio transferencia vs financiado; **Cuota Simple ya no existe** | Absorber 6 cuotas sin interés |
| 7 | Transferencia | Estado `pending_transfer` + reserva con expiración + confirmación manual | Nota al pedido sin estado |
| 8 | Pago (confirmación) | Webhook + firma + re-consulta + idempotencia | Confiar en redirect del navegador |
| 9 | Envíos | Cotización por zona + retiro | Tarifa plana nacional |
| 10 | Seguridad | Headers completos en proxy + secretos en env | Estado actual (cero headers) |

**Pendiente de confirmar con datos reales antes de cerrar pricing:** comisiones exactas de MP por plazo de liberación y por provincia, y costo real de cuotas sin interés (todo en el panel del vendedor).
