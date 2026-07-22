# Lessons — Rodak

Patrones aprendidos de correcciones y errores en este proyecto. Leer al
arrancar sesión.

## 2026-07-22 — Un número salido de un resumen no es un dato verificado

**Qué salió mal**: la exploración reportó "~111 productos" leyendo el sitemap
con WebFetch, que resume con un modelo chico. El número era falso (son 88).
Se propagó al proposal, al spec, al hito del PLAN-MAESTRO y a cuatro PRs,
hasta que la corrida real contra la API lo desmintió. Encima el "89" original
del PLAN-MAESTRO —que estaba bien— se corrigió a un valor peor.

**Regla**: un número que sale de una lectura resumida (WebFetch, el resumen de
un subagente, un preview truncado) es una estimación, no un dato. Antes de
escribirlo en docs, specs o criterios de aceptación, verificarlo contra una
fuente que devuelva el valor crudo: un header (`X-WP-Total`), un `grep -c`, un
`count(*)`. Si no se puede verificar todavía, escribirlo como estimación
explícita ("~111, sin verificar") para que nadie lo tome como hito.

## 2026-07-22 — Los CRITICAL se escondían donde el comentario prometía más que el código

**Qué salió mal**: los tres CRITICAL de la Fase 1 eran el mismo patrón. El
docstring de `resolveSalePriceCents` decía que la oferta queda "estrictamente
por debajo" del precio regular, pero el código solo comparaba igualdad. El de
`transformProduct` afirmaba que todo producto termina con al menos una
variante con precio, pero el camino de producto variable sin variaciones
devolvía cero. El de `import.ts` se declaraba "re-runnable by design", pero el
upsert por slug rompía la idempotencia al primer renombrado en el origen.

**Regla**: al revisar, tratar cada docstring que afirme una garantía como una
aserción a falsear, no como contexto. Si el comentario dice "siempre",
"nunca", "estrictamente" o "por diseño", buscar el camino que lo contradiga
antes de leer nada más. Un comentario aspiracional es peor que ninguno: hace
que el reviewer siguiente asuma la garantía en vez de verificarla.

## 2026-07-22 — `gentle-ai review start` barre los untracked ajenos al scope

**Qué salió mal**: un cambio docs-only de 45 líneas en `tasks/todo.md` dio
`risk_level: high` con los cuatro lentes 4R. La causa: un
`.claude/hooks/block-middleware.sh` sin trackear (de Facu, ajeno al cambio)
entró al scope como "intended-untracked" y, al ser un script de shell,
disparó el heurístico de integración con procesos. `--committed-only` no lo
excluye pese a lo que dicen los docs.

**Regla**: usar `--projection staged` cuando haya cualquier cosa sin commitear
en el árbol, y verificar el scope real antes de finalizar:
`.git/gentle-ai/review-transactions/v2/<lineage>/review-state.json` →
`state.initial_snapshot.paths`. Corolario general: si el nivel de riesgo
sorprende para el tamaño del cambio, sospechar del scope antes que del cambio.

## 2026-07-21 — El primer error visible del healthcheck no era la causa raíz

**Qué salió mal**: el primer deploy falló con "wget: not found" y se arregló
instalando wget (PR #11) — pero el healthcheck siguió fallando. La causa
real era otra: Next standalone se bindea a `$HOSTNAME` (Docker la setea al
container ID) y el server nunca escuchó en localhost; el wget faltante era
el *fallback* del comando de Coolify (`curl || wget || exit 1`) — curl ya
venía fallando en silencio. La pista estaba impresa desde el primer log:
`Local: http://76c0e6f65d86:3000` en vez de `localhost`. Costó un ciclo
entero de PR+deploy de más.

**Regla**: cuando un healthcheck falla contra una app que loggea "Ready",
verificar PRIMERO dónde escucha el server (la línea `Local:` de Next lo
dice) y reconstruir el comando exacto del probe antes de patchear la
herramienta que aparece en el error. En Docker+Next standalone:
`ENV HOSTNAME=0.0.0.0` siempre (está en el Dockerfile de ejemplo oficial).
Bonus del mismo ciclo: un volumen nombrado ya creado NO re-copia ownership
de la imagen — recrearlo con OTRO nombre; y `COPY --from` sin `--chown` es
root:root aunque el contenedor corra como `node`.

## 2026-07-20 — Si Facu pidió un documento para hacerlo ÉL, el documento ES la delegación

**Qué salió mal**: Facu pidió el paso a paso de deploy en un archivo para
ejecutarlo él; ante su "segui!" se le ofreció igual manejar su Chrome para
hacerlo por él. Corrección textual: "eso me hiciste el documento, para que
yo lo haga".

**Regla**: cuando Facu pide una guía/checklist para operar él mismo, el rol
de Claude queda fijado en verificar y destrabar, no en retomar la ejecución.
"Seguí" en ese contexto = esperar su avance y verificar, no buscar otra vía
para ejecutarlo.

## 2026-07-20 — El gate NUNCA se encadena con `&&` a través de un pipe

**Qué salió mal**: `gentle-ai review validate --gate pre-push | head -8 && git push`
— el pipe hace que el exit code sea el de `head` (0), no el del gate. El gate
devolvió `invalidated` y el push salió igual.

**Regla**: el resultado de un gate se evalúa ANTES del comando siguiente, en
un paso separado (o chequeando `"allowed": true` en el JSON / el exit code
directo sin pipe). Nunca `gate | filtro && acción`.

## 2026-07-20 — Review ordinaria de gentle-ai = entrega en UN solo commit

**Qué salió mal**: contenido aprobado en un receipt entregado en 2 commits
(docs + fix) → pre-push falla: "reviewed delivery is not exactly one commit
from its reviewed base". Multi-commit solo está soportado para el delivery
compuesto de una corrección acotada.

**Regla**: con review ordinaria sin corrección, un receipt = un commit. Si
se quieren commits separados por unidad de trabajo, separar también los
ciclos de review (o aceptar el squash).

## 2026-07-20 — Enmendar el candidato tras un finalize approved deja un receipt fantasma

**Qué salió mal**: primer ciclo approved → se enmendó el candidato (fix de un
WARNING) → segundo ciclo approved. El primer receipt quedó vivo y solapando
paths → el discovery de pre-push se corrompe ("authority inventory
corrupted").

**Regla**: si un hallazgo se va a arreglar antes de entregar, arreglarlo ANTES
del primer finalize (mientras el estado es reviewing) o vía la transacción de
corrección. Si ya quedó un receipt superseded: pasar `--lineage <correcto>` a
todos los gates.
