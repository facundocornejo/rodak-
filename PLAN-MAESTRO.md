# Plan Maestro — Tienda nueva Rodak (modelo balolo)

**Fecha:** 2026-07-18
**Insumos:** `AUDITORIA.md` + `DECISIONES.md`.
**Para:** decidir si el proyecto se hace, cómo, y con qué esfuerzo.

---

## 1. Veredicto de viabilidad

**¿Es viable? Sí — con una salvedad de alcance.**

Lo que juega a favor:
- Rodak **ya tiene el catálogo completo** (89 productos: muebles Y accesorios), fotografiado, con precios y descripciones. No hay que crear productos, hay que **re-modelarlos**.
- Rodak **ya tiene la marca** definida (identidad dark/dorado, tono, propuesta "diseñá tu setup"). No hay rediseño de branding.
- Rodak **ya tiene Mercado Pago funcionando** y clientes reales. No se arranca de cero comercialmente.
- El "clon de balolo" no es replicar productos alemanes — es replicar **una mecánica de venta** (bundles modulares + cross-sell curado) que encaja perfecto con lo que Rodak ya vende.
- Facu tiene el VPS y va a construir → sin costo de plataforma ni de agencia.

La salvedad: **el mecanismo modular de balolo es sofisticado**. Su "Mounting Grid patentada" es un sistema físico donde los accesorios se enchufan a la base. Rodak vende muebles convencionales (escritorios, estanterías) — sus accesorios (soporte auricular, bandeja teclado) **no son físicamente modulares del mismo modo**. Por lo tanto:

> **El clon debe ser del PATRÓN DE E-COMMERCE (configurador de bundles + cross-sell curado + reviews + PDP rico), no del sistema físico de montaje.** Rodak vende "el escritorio + los accesorios que le combinan como combo con descuento", no "una grilla con módulos que se ensamblan".

Esto es 100% viable y probablemente **más fácil** que balolo (no hay que diseñar un sistema físico patentado, solo la capa de software de bundles).

**Esfuerzo total estimado del camino recomendado: ~120–180 horas** de desarrollo (ver §4), repartibles en fases entregables. Es un proyecto real de varias semanas part-time, no un fin de semana.

---

## 2. Los tres caminos (comparación honesta)

| Criterio | (A) Custom Next.js en VPS ⭐ | (B) Renovar WooCommerce | (C) Plataforma (Shopify/Tiendanube) |
|---|---|---|---|
| Esfuerzo inicial | Alto (~120–180 h) | Medio (~50–80 h) | Bajo (~30–50 h) |
| Costo mensual | Solo el VPS (ya pago) | Solo hosting (ya pago) | **Fee % por venta** + plan mensual |
| Fee por venta | 0 (solo comisión MP) | 0 (solo comisión MP) | Shopify/Tiendanube cobran % — **duele en tickets de $1M** |
| Configurador de bundles | Control total, hecho a medida | Plugins apilados (frágil) | Apps de terceros (mensualidad + límites) |
| Performance/SEO | Óptimo (se controla todo) | Se hereda el stack pesado actual | Bueno pero con overhead de la plataforma |
| Mantenimiento | Tuyo (código propio) | 14 plugins que se actualizan y rompen | Mínimo (lo maneja la plataforma) |
| Control del checkout | Total (Bricks embebido) | Limitado por plugin de pago | Limitado por la plataforma |
| Riesgo | Mayor (todo es tuyo, incluido bugs) | Medio | Menor técnicamente, mayor lock-in |
| Aprendizaje (para Facu) | Altísimo | Bajo | Bajo |

**Recomendación: (A) Custom.** Razones decisivas: (1) tickets altos → cualquier fee % de plataforma se come el margen; (2) el configurador de bundles es el diferencial y en custom se hace exactamente como se quiere; (3) el VPS ya está; (4) valor de aprendizaje para Facu. 

**Cuándo elegir (B) o (C) en su lugar:** si el objetivo real fuera "salir ya con lo mínimo", (C) Tiendanube saca una tienda AR con MP en días. Pero no da el configurador modular sin apps y cobra por venta. (B) sirve como **plan B de contingencia**: si el custom se estanca, se puede lograr un 70% del efecto sumando un plugin de bundles al WooCommerce actual y arreglando robots.txt/headers.

---

## 3. Quick wins inmediatos (independientes del proyecto grande)

Estos se pueden hacer sobre rodak.ar **hoy**, sin esperar la tienda nueva, y dan valor ya:

1. 🔴 **Arreglar `robots.txt`** — quitar `Request-rate 6/60m`, `Crawl-delay 60`, `Visit-time` y el `Disallow: /*?` demasiado amplio. Recupera el crawl de Google. *(15 min, impacto SEO alto.)*
2. 🔴 **Corregir el texto "Cuota Simple 14,25%"** en los PDP — el programa ya no existe, es información falsa al cliente. *(según cuántos productos lo tengan.)*
3. 🟠 **Agregar security headers** en el Apache actual (HSTS, X-Frame-Options, nosniff, Referrer-Policy). *(1–2 h.)*

> ⚠️ **Regla dura del proyecto:** un solo agente por working tree. Rodak.ar es WordPress en producción de un tercero — estos cambios los hace Facu con cuidado y backup previo, no automatizados a ciegas.

---

## 4. Plan de ejecución por fases (camino A)

Cada fase es un cambio SDD independiente (`/sdd-new`), entregable y verificable. Estimaciones en horas de desarrollo.

### Fase 0 — Fundaciones (~15–20 h)
- Bootstrap del proyecto en el VPS: Next.js + Postgres + Prisma + Docker + Caddy (HTTPS).
- Esquema de DB inicial (`Product`, `ProductVariant`, `Category`, `ProductMedia`).
- CI mínimo y entorno de staging.
- **Hito verificable:** app corriendo en el VPS con HTTPS y una página que lista productos de la DB.

### Fase 1 — Migración de catálogo (~15–25 h)
- Exportar los 89 productos + imágenes + categorías desde WooCommerce (REST API / CSV).
- Script de transformación al modelo nuevo (variantes por material y medida, precios en centavos).
- **Preservar slugs** para los redirects.
- **Hito verificable:** los 89 productos visibles en la tienda nueva con sus fotos, precios y categorías, contados 1:1 contra el catálogo actual.

### Fase 2 — Catálogo y PDP rico (~25–35 h)
- Home, grilla de categoría, búsqueda, PDP con galería, selector de material/medida (swatches), tabs (Descripción/Specs/Envío/Reviews).
- Reviews propias (modelo + UI). Tags de producto (BEST SELLER/NEW).
- Aplicar `refactoring-ui` sobre la identidad existente de Rodak. Objetivo de performance: pocos scripts (referencia balolo: 18, no 78).
- **Hito verificable:** recorrido completo home → categoría → producto navegable y responsive en dispositivo real.

### Fase 3 — El configurador de bundles (~25–35 h) ← EL CORAZÓN
- Tabla `CompatibleAccessory`: curar qué accesorios combinan con qué muebles.
- `Bundle` + `BundleItem`: bundles pre-armados con % descuento y precio tachado.
- Configurador inline en el PDP ("agregá accesorios", contador, precio dinámico del combo).
- **Hito verificable:** entrar a un escritorio, sumarle 2 accesorios, ver el precio del combo actualizarse, y que llegue así al carrito.

### Fase 4 — Carrito, checkout y pagos (~30–40 h) ← EL MÁS CRÍTICO
- Carrito con stock reservado (decremento atómico).
- **MP Checkout Bricks** (Payment Brick) + backend Node.
- **Webhooks** con validación de firma + re-consulta + idempotencia.
- **Flujo de transferencia** con estado `pending_transfer`, reserva con expiración, panel de confirmación manual.
- Descuento por transferencia; lógica de precio con/sin financiación.
- **Hito verificable:** compra real de prueba end-to-end con MP (credenciales de test → luego producción) **y** una compra por transferencia que el admin confirma. *(Regla dura: el gate es el run real contra MP, no tests con mocks.)*

### Fase 5 — Panel de administración (~15–25 h)
- ABM de productos/variantes/stock/bundles/compatibilidades.
- Gestión de órdenes (estados, confirmación de transferencias).
- Moderación de reviews.
- **Hito verificable:** el amigo puede cargar un producto nuevo y confirmar una transferencia sin tocar código.

### Fase 6 — Migración SEO y go-live (~10–15 h)
- **Redirects 301** de todas las URLs actuales (`/producto/*`, `/categoria-producto/*`) a las nuevas. *(Crítico: reemplaza rodak.ar en el mismo dominio.)*
- `robots.txt` sano, sitemap, metadata, datos estructurados (JSON-LD Product).
- Security headers, backups verificados.
- Checklist de entrega (skill `checklist-entrega-cliente`): seed creíble, prueba por rol, invariantes en 0, responsive real, credenciales demo, plan de rollback.
- **Hito verificable:** dominio apuntando a la tienda nueva, URLs viejas redirigiendo 301, compra real funcionando, backup restaurable verificado.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El configurador modular se subestima (Fase 3) | Es el diferencial: darle buffer. Empezar con bundles simples (2-3 accesorios fijos) antes del configurador libre. |
| Pagos con MP fallan en producción (comportamiento ≠ sandbox) | *Regla dura:* verificar contra MP real, no mocks. Salir con Checkout Pro como fallback si Bricks se complica. |
| Migración SEO mal hecha → caída de tráfico orgánico al reemplazar el dominio | Redirects 301 exhaustivos, mantener slugs, avisar a Google Search Console, no apagar rodak.ar hasta validar. |
| Sobreventa por reserva de stock mal implementada | Decremento atómico en DB + expiración de reserva. Testear concurrencia. |
| Proyecto largo se estanca part-time | Fases entregables: cada una deja algo usable. Plan B (WooCommerce + plugin) siempre disponible. |
| Fees de MP mal calculados en el pricing | Confirmar comisiones reales en el panel del vendedor ANTES de fijar precios (varían por provincia; Cuota Simple ya no existe). |

---

## 6. Qué necesita aportar el amigo (dueño de Rodak)

- Acceso/export del catálogo WooCommerce actual (o credenciales para exportarlo).
- Cuenta de Mercado Pago con datos fiscales y **credenciales de producción** (Public Key + Access Token) cuando toque Fase 4.
- Datos bancarios para el flujo de transferencia (CBU/alias/titular/CUIT).
- Definición de qué accesorios combinan con qué muebles (insumo de Fase 3 — es conocimiento de negocio suyo).
- Fotos/textos faltantes y decisión sobre plazos/zonas de envío.
- Confirmación de la estrategia de cuotas y descuentos.

---

## 7. Próximo paso concreto

Este plan es el insumo directo del ciclo SDD. Cuando decidan arrancar:

```
/sdd-new fase-0-fundaciones
```

...y se ejecuta fase por fase (proposal → spec → design → tasks → apply → verify → archive), cada una con su revisión. La **Fase 0** y los **quick wins del §3** son los puntos de entrada de menor riesgo para empezar a ver movimiento.

---

### Nota de decisión pendiente (del dueño + Facu, no de este informe)
Este documento **recomienda**; la decisión final es de ellos. Los tres puntos abiertos son: (1) ¿custom, WooCommerce o plataforma?; (2) ¿se hacen los quick wins sobre rodak.ar ya?; (3) ¿confirmación de comisiones MP y estrategia de cuotas para el pricing?
