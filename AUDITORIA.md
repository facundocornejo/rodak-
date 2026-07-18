# Auditoría integral — rodak.ar vs balolo.de

**Fecha:** 2026-07-18
**Autor:** Facu (con Claude)
**Objetivo:** Diagnosticar la tienda actual de Rodak y hacer ingeniería inversa de la referencia (balolo.de) para fundamentar el proyecto de tienda nueva.

> Toda afirmación técnica de este informe está respaldada por evidencia (headers HTTP, HTML, sitemaps, navegación real). Los pocos datos no verificables están marcados como tales.

---

## Parte A — rodak.ar (estado actual)

### A.0 Stack detectado (evidencia: headers + HTML)

| Componente | Valor | Fuente |
|---|---|---|
| Servidor | Apache | header `Server` |
| CMS | WordPress 7.0.1 | meta `generator` |
| E-commerce | WooCommerce | HTML + clases |
| Theme | Woodmart + Woodmart-child | `wp-content/themes/` |
| Page builder | Elementor 4.1.4 | meta `generator` |
| Slider | Slider Revolution 6.7.52 | meta `generator` |
| SEO | Rank Math | comentario en sitemap |
| Seguridad | Wordfence | `wp-content/plugins/` |
| Pasarela | Mercado Pago (`woocommerce-dynamic-payments-v1`, `Preference` en checkout) | HTML |
| Otros plugins | contact-form-7, creame-whatsapp-me, facebook-for-woocommerce, google-listings-and-ads, woo-discount-rules-pro, checkout-field-editor, honeypot | HTML |

**Catálogo:** 89 productos, ~21 categorías (product-sitemap.xml). Ticket alto (ej. Escritorio Brent Paraiso $1.112.713). Estructura de URL: `/producto/{slug}/` y `/categoria-producto/{slug}/`.

### A.1 Hallazgos por severidad

#### 🔴 P0 — SEO estrangulado por robots.txt
El `robots.txt` limita el crawl de forma severa:
```
Crawl-delay: 60
Request-rate: 6/60m        # solo 6 documentos indexables cada 60 minutos
Visit-time: 0300-1200       # solo permite crawl en una ventana horaria
Disallow: /*?               # bloquea toda URL con querystring (búsqueda, filtros, paginación facetada)
```
Con 6 páginas/hora, indexar 89 productos + categorías + blog tarda **días** por pasada, y Google penaliza el rastreo. Esto es autoinfligido y probablemente heredado de una plantilla de robots.txt vieja. **Impacto directo en ventas: menos visibilidad orgánica.**
→ *Corrección trivial* incluso sin rehacer la tienda.

#### 🔴 P1 — Cero headers de seguridad
Ningún header presente: sin `Strict-Transport-Security` (HSTS), `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy` ni `Permissions-Policy`. Además la versión exacta de WordPress y plugins queda expuesta en el HTML (superficie para bots que escanean CVEs conocidos). Wordfence mitiga algo, pero la ausencia total de headers es un gap real.

#### 🟠 P1 — Performance: stack pesado
Home: **HTML de 485 KB**, **78 `<script src>`**, 9 hojas de estilo, 118 imágenes en el HTML inicial. La combinación Elementor + Slider Revolution + Woodmart es notoriamente pesada. No se pudo medir Core Web Vitals con PageSpeed API (quota anónima agotada — requiere API key), pero el peso y la cantidad de scripts anticipan un LCP y TBT malos en mobile. *(Comparación: balolo tiene HTML más grande, 706 KB, pero solo 18 scripts — ver Parte B.)*

#### 🟡 P2 — Información de cuotas DESACTUALIZADA
El PDP publicita "**6 CUOTAS (CUOTA SIMPLE) 14,25%**". El programa **Cuota Simple (ex Ahora 12) fue derogado en junio 2026** (ver `DECISIONES.md` §Pagos). Es información incorrecta hoy expuesta al cliente. También "12 CUOTAS 93,66%" sugiere financiación con interés altísimo mal comunicada.

#### 🟡 P2 — Cross-sell no curado
El PDP del escritorio muestra "Productos Relacionados" (soporte auricular $29k, soporte celular $6k, board, elevación monitor) — pero es el bloque **genérico de WooCommerce por categoría**, no una selección curada de accesorios que combinan con *ese* escritorio. Es justamente el mecanismo que balolo explota (ver Parte B). **El dato clave: Rodak YA VENDE los accesorios; le falta la mecánica para venderlos junto al mueble.**

#### 🟡 P2 — Otros
- SKU "N/D" en el producto auditado → gestión de inventario floja.
- El PDP tiene un único eje de variante ("Medida (mm)") con una sola opción cargada → variantes infrautilizadas.
- Botón "Consultanos por otras medidas" (WhatsApp) → parte del catálogo se vende por conversación, no self-service.

### A.2 Lo que rodak.ar hace bien
- Branding sólido y coherente (dark + dorado, "Diseñá tu setup"). No hay que rehacer la identidad.
- Propuesta de valor clara para el nicho setup/home-office.
- Ya tiene Mercado Pago funcionando, descuento por transferencia (10%), y catálogo real fotografiado.
- Rank Math + sitemaps bien generados (el problema es el robots.txt, no el SEO on-page).

---

## Parte B — balolo.de (referencia a "clonar")

### B.0 Stack detectado
Shopify + theme custom, detrás de Cloudflare. Apps: **Judge.me** (reviews), **Klaviyo** (email marketing), **Pandectes** (consentimiento GDPR), **Bold**. ~68 productos. Precios en EUR.

### B.1 El modelo de negocio (esto es lo que importa)

Balolo NO vende "muebles + accesorios" como listas separadas. Vende un **sistema modular**:

```
Setup Cockpit (soporte de monitor)  ←  PRODUCTO BASE / FUNDACIÓN
   │  tiene una "Mounting Grid" patentada
   └─→ Add-ons modulares que se enchufan a la grilla:
        MagSafe Holder, Headphone Holder, Phone Holder,
        Apple Watch Holder, Pen Holder, Cable Magnets,
        Trays, Laptop Dock, Tablet Holder, Smart Accessory Holder...
```

**Mecánica central (el corazón del proyecto):** el PDP del producto base tiene un **configurador de accesorios inline**. Textualmente en la página: *"You have 0 accessories selected"* y *"Add to bundle"*. El cliente arma su combo en la misma página del producto, sumando holders de $39–54 cada uno → **dispara el ticket promedio (AOV)** sin fricción.

### B.2 Patrones de PDP replicables (clasificados)

| Patrón | ¿Imprescindible? | Notas de implementación |
|---|---|---|
| **Configurador de accesorios en el PDP** ("add to bundle", contador de accesorios) | ✅ Imprescindible | Es la razón del proyecto. Requiere modelo de datos "producto base ↔ accesorios compatibles". |
| **Bundles pre-armados con % descuento** y precio tachado ("SAVE 18%", $604 ~~$794~~) | ✅ Imprescindible | Aumenta AOV y percepción de ahorro. |
| **Selector de material como botones/swatches** (Walnut / Oak / All Black) | ✅ Imprescindible | Rodak ya maneja maderas (Paraíso, Cedro) → mapea directo. |
| **Reviews con contador visible** (Judge.me, "977 reviews", "87.549 happy customers") | ✅ Imprescindible | Prueba social. Falta 100% en rodak. Empezar juntando reviews desde el día 1. |
| **Tabs de PDP**: Description / Specs / Details / FAQ / Reviews | 🟨 Deseable | Rodak ya tiene Descripción/Info/Envío; sumar Specs y Reviews. |
| **Stock + fecha de despacho + countdown** ("dispatch by Monday if you order within 1d 19h") | 🟨 Deseable | Urgencia honesta. Requiere lógica de stock real. |
| **Tags de producto** (BEST SELLER, NEW, BUNDLE, MODULAR ADD-ONS) | 🟨 Deseable | rodak ya tiene `woocommerce-advanced-product-labels`. |
| **"Create Custom Setup"** (armado guiado desde cero) | 🟦 Omitible v1 | Versión avanzada del configurador; dejar para fase 2. |
| Multi-moneda / multi-idioma (USD/EUR, EN/DE) | 🟦 Omitible | Rodak es AR-only, ARS. No aplica. |
| Newsletter (Klaviyo) | 🟨 Deseable | Captura de emails; se puede hacer con cualquier ESP. |
| Hotline telefónica + horario de atención | 🟦 Omitible v1 | Rodak usa WhatsApp, que para AR es superior. Mantener WhatsApp. |
| Hero cinematográfico en video | 🟨 Deseable | Estética premium; rodak ya tiene fotografía de producto buena. |
| Disciplina de performance (706 KB HTML pero **solo 18 scripts**) | ✅ Imprescindible | Objetivo técnico, no feature. Un stack custom liviano supera esto fácil. |

### B.3 Taxonomía de producto de balolo (a mapear al catálogo de rodak)

- **Productos fundación**: Setup Cockpit Medium/Large (soporte monitor). En rodak, el equivalente son los **escritorios** y las **elevaciones de monitor**.
- **Bundles**: sets pre-configurados con descuento.
- **Add-ons modulares**: taggeados "MODULAR ADD-ONS", se enchufan a la grilla. En rodak: soportes, bandeja teclado, cajones, organizadores.
- **Accesorios standalone**: pen holders, trays, desk pads, coasters, planters.
- Todo con eje de **material** (3 acabados) y algunos con eje de **tamaño**.

---

## Parte C — El gap en una frase

> Rodak ya tiene **el catálogo** (muebles + accesorios) y **la marca**. Lo que le falta es **el sistema**: vincular accesorios a muebles, un configurador de bundles en el PDP, reviews/prueba social, y una base técnica sana (performance + SEO + seguridad). El "clon de balolo" no es copiar productos — es copiar **la mecánica de venta modular** sobre el catálogo que Rodak ya tiene.

Las decisiones de arquitectura, datos, pagos y hosting que se derivan de esta auditoría están en **`DECISIONES.md`**. El veredicto de viabilidad y el plan de ejecución, en **`PLAN-MAESTRO.md`**.
