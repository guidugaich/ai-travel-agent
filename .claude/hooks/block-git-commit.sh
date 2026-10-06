#!/bin/bash
# PreToolUse(Bash): the user reviews and makes every commit.
cmd=$(jq -r '.tool_input.command // empty')
pattern='(^|[;&|({[:space:]])git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--?[A-Za-z][A-Za-z-]*(=[^[:space:]]+)?)*[[:space:]]+commit([[:space:]]|$)'

if printf '%s' "$cmd" | grep -Eq "$pattern"; then
  jq -n '{hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "The user makes all commits in this repo. Leave the changes uncommitted and suggest a commit message instead."
  }}'
fi
exit 0
