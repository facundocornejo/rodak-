#!/usr/bin/env bash
# PreToolUse(Edit|Write) — gotcha Next 16 (STACK_GOTCHAS): middleware.ts fue
# reemplazado por proxy.ts y Next lo ignora en silencio.
#
# Cubre .ts/.js/.mts/.mjs: Next reconocía la convención en cualquiera de esas
# extensiones y el ignorado silencioso cuesta lo mismo en todas.
#
# Si jq falta o el payload no parsea, la edición PASA (no tiene sentido frenar
# todo el trabajo por una dependencia rota) pero avisa por stderr: un guard que
# deja de guardar en silencio es exactamente el problema que vino a evitar.
payload=$(cat)

if ! fp=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty'); then
  echo "block-middleware: jq falló o no está instalado; la edición pasa SIN chequear middleware.ts." >&2
  exit 0
fi

case "$(printf '%s' "$fp" | tr '\\' '/')" in
  */middleware.ts|middleware.ts|*/middleware.js|middleware.js|*/middleware.mts|middleware.mts|*/middleware.mjs|middleware.mjs)
    jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"Next 16: middleware.ts ya no existe (Next lo ignora sin warning) — usá proxy.ts. Y proxy.ts solo hace headers, JAMÁS auth: la autorización va deny-by-default en cada server action."}}'
    ;;
esac
exit 0
