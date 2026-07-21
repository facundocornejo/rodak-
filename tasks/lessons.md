# Lessons — Rodak

Patrones aprendidos de correcciones y errores en este proyecto. Leer al
arrancar sesión.

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
