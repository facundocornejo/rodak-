# Lessons — Rodak

Patrones aprendidos de correcciones y errores en este proyecto. Leer al
arrancar sesión.

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
