#!/bin/bash
# PostToolUse(Edit|Write): format the edited file and report lint errors back to Claude.
file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$file" in
  "$root"/node_modules/* | "$root"/*/node_modules/*) exit 0 ;;
  "$root"/*) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "$root" || exit 0

. scripts/use-project-node.sh

pnpm exec prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1

case "$file" in
  *.ts | *.js | *.mjs | *.cjs)
    if ! out=$(pnpm exec eslint --no-warn-ignored "$file" 2>&1); then
      jq -n --arg r "$out" '{decision: "block", reason: ("ESLint reported problems in the file you just edited:\n" + $r)}'
    fi
    ;;
esac
exit 0
