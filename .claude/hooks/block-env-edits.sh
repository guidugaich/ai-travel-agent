#!/bin/bash
# PreToolUse(Edit|Write|NotebookEdit): .env files hold secrets; only .env.example may be edited.
file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
name=$(basename "$file")

case "$name" in
  .env.example) ;;
  .env | .env.*)
    jq -n --arg f "$file" '{hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Editing " + $f + " is blocked: .env files hold secrets. Ask the user to change it, or edit .env.example instead.")
    }}'
    ;;
esac
exit 0
