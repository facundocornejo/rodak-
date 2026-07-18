# Performance — ¿qué lenguaje/stack hace rápida a la tienda?

**Fecha:** 2026-07-18 · **Origen:** pregunta de Facu ("me interesa mucho que la página sea rápida y eficiente, con muchas imágenes de calidad, videos y animaciones — ¿qué lenguajes son lo mejor?"). Investigación con fuentes primarias (Web Almanac/HTTP Archive, docs oficiales de Next.js/Cloudflare/Traefik/MDN, benchmarks 2024-2026). Servidor real considerado: netcup RS 1000 G12 (4 cores dedicados Zen 5, 8 GB, Coolify/Traefik, Cloudflare DNS).

---

## 1. ¿El lenguaje importa? No es el factor dominante — evidencia contundente

**Dónde está el cuello de botella real.** El Web Almanac 2024 de HTTP Archive (dataset de millones de sitios reales) muestra que en sitios con LCP pobre el subcomponente que más pesa es el **TTFB: 2,27 s solo en el primer byte** (casi el umbral entero de un LCP "bueno", 2,5 s). El segundo factor es el *resource load delay* (cuánto tarda el browser en EMPEZAR a descargar la imagen LCP, por mala priorización). Los dos se resuelven con **cache/CDN** y **priorización de recursos**, no con un runtime más rápido. En sitios media-heavy, los bytes de imágenes/video dominan el peso total.

**¿Y el runtime?** En benchmarks sintéticos Go hace ~180k req/s donde Node hace ~40k — irrelevante acá: un VPS de 2 cores sirve ~193–275 req/s de páginas Next.js prerenderizadas (SSR puro: ~34 req/s — por eso ISR/estático es la clave). Con 90 productos cacheados detrás de Cloudflare, el servidor sirve archivos. **Migrar de lenguaje no cambiaría nada perceptible; cachear mal lo cambiaría todo.**

**Lo que sí importa: JavaScript enviado al cliente.** Los datos reales de CWV favorecen a Astro (~40% más rápido, bundles ~90% menores) porque embarca cero JS por defecto — pero en un e-commerce con carrito/checkout esa ventaja se achica (vas a necesitar islas JS igual), y Next.js con Server Components captura casi todo el beneficio manteniendo los Client Components al mínimo. El INP malo viene sobre todo de scripts de terceros, no del framework.

**Veredicto:** PHP, Rails, Go o Node sirven este sitio igual de rápido si los assets y el cache están bien; igual de lento si no. Cambiar el stack sería costo sin retorno.

Fuentes: https://almanac.httparchive.org/en/2024/performance · https://almanac.httparchive.org/en/2024/page-weight · https://almanac.httparchive.org/en/2024/media · https://martijnhols.nl/blog/how-much-traffic-can-a-pre-rendered-nextjs-site-handle · https://www.techempower.com/benchmarks/ · https://alexbobes.com/programming/astro-vs-nextjs/

## 2. Pipeline de imágenes de alta calidad

| Formato | Soporte | Para fotografía de muebles |
|---|---|---|
| WebP | ~97% | Fallback seguro; ~25-30% menor que JPEG |
| **AVIF** | ~93–95% | **Ganador**: 40–50% menor que JPEG, hasta ~60% en hi-res |
| JPEG XL | ~14% | NO para producción todavía |

- `next/image` con `formats: ['image/avif', 'image/webp']`. Calidad AVIF ~60–70 suele ser indistinguible; probar con fotos reales (vetas finas de madera a veces piden más).
- **Self-hosteado en el VPS**: optimiza on-demand con sharp y cachea en `.next/cache/images`. La primera request paga CPU (AVIF en frío: 3–5 s/imagen); con 90 productos el universo de variantes se calienta en horas. **PERSISTIR `.next/cache` como volumen en Coolify** (si no, cada deploy re-encodea todo). Gotcha sharp/glibc: memory allocator (jemalloc o `MALLOC_ARENA_MAX`) — nota oficial de sharp. Limitar `deviceSizes`/`imageSizes` a los breakpoints reales; subir `minimumCacheTTL`.
- `sizes` correcto por layout (grilla: `(max-width: 768px) 50vw, 25vw`) — sin eso el browser baja la variante más grande.
- **JAMÁS lazy-loadear la imagen LCP**: `priority` en hero/primera imagen de PDP (mejora mediana de 0,7 s de LCP según web.dev). Below-the-fold sí lazy (default).
- Alternativas si el VPS sufriera: pre-optimizar en build, Cloudflare Image Transformations, o Cloudflare Images (~$5–7/mes). Polish es redundante con next/image.

Fuentes: https://nextjs.org/docs/app/guides/self-hosting · https://sharp.pixelplumbing.com/install#linux-memory-allocator · https://web.dev/articles/fetch-priority · https://www.filemint.dev/blog/avif-format-2026 · https://blog.platformatic.dev/scale-nextjs-image-optimization-platformatic

## 3. Video eficiente

- **Codecs:** H.264/MP4 = soporte ~100%; AV1 comprime 30–50% mejor. Estrategia: `<video>` con `<source>` AV1/VP9 primero + MP4 fallback. 1080p a 1.200–1.800 kbps o CRF ~28–33, sin audio.
- **Para clips cortos (hero loops, videos de producto de 10–30 s), `<video>` progresivo alcanza** — HLS solo para videos largos.
- Hero estilo balolo: `<video autoplay muted loop playsinline poster="...">` (`muted` obligatorio para autoplay). **Peso: 2–5 MB, máximo ~10 MB; 5–15 s de loop; 720p suele bastar.** Videos click-to-play: `preload="none"` + poster.
- **⚠️ Gotcha legal de Cloudflare:** el ToS restringe servir video por el proxy (nube naranja) si NO está hosteado en un producto de CF (Stream/R2/Images). Servir MP4s del VPS detrás del proxy gratis viola el ToS.
- **Recomendación: Cloudflare R2** — 10 GB gratis, **egress $0** → ~$0/mes a esta escala, permitido por ToS, cacheado por CF. YouTube/Vimeo embed: no apto para hero (cientos de KB de JS + cookies); si se usara, con fachada `lite-youtube-embed`.

Fuentes: https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/ · https://developers.cloudflare.com/stream/pricing/ · https://evilmartians.com/chronicles/better-web-video-with-av1-codec · https://designtlc.com/how-to-optimize-a-silent-background-video-for-your-websites-hero-area/

## 4. CDN: Cloudflare free delante del VPS — sí

- Por defecto cachea solo assets por extensión; **HTML no**.
- **Cache Rule `/_next/static/*`**: Edge TTL 1 mes+ (Next ya emite immutable con hash) → hit ~100%.
- **Cache Rule `/_next/image*`**: respetar header del origen (`minimumCacheTTL`) → el VPS encodea una vez, CF absorbe el resto.
- **HTML (la palanca grande de TTFB):** edge-cache de páginas de catálogo con TTL corto (1–4 h) y **bypass con cookie de carrito/sesión**. Next marca estáticas con `s-maxage + stale-while-revalidate` y dinámicas con `private` — CF respeta.
- **SSL: Full (strict)** sí o sí (Flexible = loops + inseguro). Verificar `X-Forwarded-Proto` hacia Traefik.
- **Argentina:** CF tiene PoP en Buenos Aires (EZE), pero en el free tier el tráfico puede rutearse a Miami (~170 ms) en congestión. Aun así vale: TLS edge, HTTP/3, cache, IP oculta. Alternativa barata con buena presencia SA si hiciera falta: BunnyCDN.

Fuentes: https://developers.cloudflare.com/cache/how-to/cache-rules/ · https://focusreactive.com/configure-cdn-caching-for-self-hosted-next-js-websites/ · https://blog.cloudflare.com/buenos-aires/ · https://community.cloudflare.com/t/does-cloudflare-free-plan-support-caching-html-css-and-img-on-buenos-aires-argentina/73539

## 5. Animaciones performantes

- **Solo `transform` y `opacity`** (compositor, 60fps); jamás width/height/top/left/margin ni box-shadow/filter grandes. `will-change` con moderación y sacarlo después.

| Opción | Bundle | Cuándo |
|---|---|---|
| CSS / WAAPI | 0 KB | El 80% de un e-commerce premium |
| CSS scroll-driven | 0 KB | Reveal/parallax sin JS. Chrome/Edge completo, Safari 17.5+ parcial, Firefox en desarrollo → progressive enhancement con `@supports (animation-timeline: scroll())` |
| Motion (ex Framer) | ~5–30 KB | Enter/exit y layout animations en React |
| GSAP + ScrollTrigger | ~27 KB+ | Coreografía de scroll compleja. **100% gratis desde 2025** (plugins premium incluidos). Cargar con `next/dynamic` |

- CSS primero; Motion para transiciones de UI; GSAP solo si el diseño pide storytelling de scroll. No usar ambas para lo mismo. **`prefers-reduced-motion` obligatorio** (+ pausar autoplay del hero para esos usuarios).

Fuentes: https://motion.dev/docs/gsap-vs-motion · https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations · https://caniuse.com/mdn-css_properties_animation-timeline_scroll

## 6. El VPS de 8 GB: sobra, con tuning mínimo

1. `output: 'standalone'` + **volumen persistente para `.next/cache`** (ISR + imágenes; instancia única no necesita Redis ni cache handler custom).
2. **Compresión NO en Node**: `compress: false` en Next; la hace Traefik (gzip/brotli/zstd nativos) o directamente Cloudflare edge→visitante.
3. HTTP/3: Cloudflare ya lo termina en el edge gratis — nada que hacer en Traefik.
4. sharp: memory allocator (§2).
5. **Nada exótico**: sin Redis, sin clúster, sin Varnish. Postgres local para 90 productos responde en milisegundos, e ISR hace que ni corra por request.

Fuentes: https://nextjs.org/docs/app/guides/self-hosting · https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/

## 7. Veredicto

> **El lenguaje no es lo que hace rápida o lenta a esta tienda.** En un sitio con fotos y videos pesados, la carga percibida se va en descargar y priorizar bytes de media y en la distancia al servidor — se resuelve con formatos modernos, cache y CDN. El servidor (Node, PHP o Go) tarda milisegundos en generar una página de 90 productos que además queda cacheada. Next.js/TypeScript está entre los mejores stacks del mundo para exactamente este trabajo; cambiarlo no movería la aguja.

**Top 5 acciones por impacto:**
1. **Estático/ISR + Cloudflare adelante** (Full strict, Cache Rules, edge-cache de HTML con bypass por cookie) → ataca el cuello #1: TTFB.
2. **Pipeline de imágenes** (AVIF+WebP, `sizes`, `priority` en LCP, cache de sharp en volumen) → ataca el 60–80% del peso.
3. **Videos en R2** (egress $0, permitido por ToS; hero ≤5 MB mudo con poster).
4. **Disciplina de JS cliente** (Server Components por defecto, `next/dynamic`, terceros al mínimo) → protege INP.
5. **Animaciones compositor-only** (CSS primero, Motion/GSAP con dynamic import, `prefers-reduced-motion`).

Con esto, el catálogo en este VPS debería clavar **LCP < 2 s y Core Web Vitals en verde desde Argentina** — sin tocar el lenguaje.
