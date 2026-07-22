#!/usr/bin/env bash
# PostToolUse(Edit|Write) — Prettier solo sobre el archivo editado, y solo si el
# proyecto tiene Prettier configurado e instalado (no impone convenciones ajenas).
input=$(cat)
fp=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)
case "$fp" in *.ts|*.tsx|*.js|*.jsx|*.css|*.json|*.md) ;; *) exit 0 ;; esac
fp=$(printf '%s' "$fp" | tr '\\' '/')
[ -f "$fp" ] || exit 0
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
bin="$root/node_modules/.bin/prettier"
[ -x "$bin" ] || exit 0
if ls "$root"/.prettierrc* >/dev/null 2>&1 || grep -q '"prettier"' "$root/package.json" 2>/dev/null; then
  # El `--` es obligatorio: sin el, un archivo llamado p.ej. `--plugin=./x.js`
  # pasa el filtro de extension y Prettier lo lee como flag, no como nombre de
  # archivo — y `--plugin`/`--config` cargan y ejecutan JS arbitrario.
  "$bin" --write --ignore-unknown -- "$fp" >/dev/null 2>&1
fi
exit 0
