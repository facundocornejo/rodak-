# Revisión de arquitecto — Plan de planning Fase 2 (Rodak)

Sos un arquitecto de software senior revisando el PLAN DE PLANNING de la Fase 2
de Rodak (tienda Next.js 16 + Prisma/Postgres, repo en `B:\testpair`). NO toques
ningún archivo del repo: tu trabajo es solo leer y emitir veredicto.

## Archivos a leer

1. `B:\testpair\PLAN-FASE-2-PLANNING.md` (el plan a revisar)
2. `B:\testpair\PLAN-MAESTRO.md` (fases del proyecto — la Fase 2 está en §4)
3. `B:\testpair\.impeccable.md` (dirección visual vinculante)
4. `B:\testpair\tasks\todo.md` (estado y pendientes)
5. `B:\testpair\prisma\schema.prisma` (schema actual)
6. `B:\testpair\src\lib\data\products.ts` y `B:\testpair\src\lib\db.ts` (data layer)
7. `B:\testpair\next.config.ts` y `B:\testpair\PERFORMANCE.md` (imágenes y caching)
8. `B:\testpair\mockups\producto.html` y `B:\testpair\mockups\index.html`
   (blueprint de layout — ojo: su tema oscuro NO manda, se decidió base clara)

## Contexto

El plan describe una sesión de PLANNING SDD (explore → proposal → spec →
design → tasks, artefactos en engram, gates de aprobación humana en proposal y
design). La implementación la ejecuta después otro agente (Opus) en sesión
fresca usando solo las tasks. O sea: revisás el plan del planning y sus
insumos, no código.

## Qué evaluar

Respondé con hallazgos numerados (formato: `N. [SEVERIDAD] título — detalle —
evidencia con archivo:línea`):

- **A. CONSISTENCIA**: ¿el alcance del plan coincide con la Fase 2 del
  PLAN-MAESTRO sin colarse nada de Fases 3-6 (bundles, carrito, admin,
  SEO/go-live)? ¿Las exclusiones del mockup (configurador de bundles,
  add-to-cart) están bien delimitadas?
- **B. INSUMOS**: ¿los "insumos" que el plan les pasa a las fases SDD son
  correctos contra el código real? ¿Falta alguna restricción del repo que las
  tasks deberían conocer? (buscá invariantes en comentarios del schema y de
  `src/lib/db.ts`)
- **C. RIESGOS TÉCNICOS**: el conflicto force-dynamic vs ISR/cacheComponents y
  la propuesta de mover el healthcheck a ruta dedicada; el modelo Review
  aditivo con enum de moderación; búsqueda con Postgres FTS/trigram a escala
  de 88 productos; imágenes hotlinkeadas sin width/height con next/image.
  ¿Algo mal planteado, faltante o sobredimensionado?
- **D. PROCESO**: ¿los gates (proposal y design) están en el lugar correcto?
  ¿Las tasks "autocontenidas para ejecutor sin memoria" son el artefacto
  correcto? ¿Falta algún criterio de verificación en la sección de
  verificación del plan?
- **E. LO QUE FALTA**: nombrá máximo 3 cosas que vos agregarías al plan y por
  qué.

## Cierre

Terminá con un veredicto: **APROBAR** / **APROBAR CON CAMBIOS** (listalos) /
**RECHAZAR** (explicá). Sé específico y crítico; no rellenes con elogios.
Guardá tu respuesta completa en `B:\testpair\CODEX-REVIEW-VEREDICTO.md`.
