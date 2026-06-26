#!/usr/bin/env bash
# Stop hook: block the turn from ending if TypeScript has errors, feeding the
# errors back so they get fixed before handoff. tsc is the reliable gate here
# (the repo is tsc-clean); eslint is intentionally NOT blocking yet because the
# existing code trips style rules that aren't real bugs.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd /Users/julien/Desktop/trainlog || exit 0
out=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  printf '{"decision":"block","reason":%s}\n' \
    "$(printf 'TypeScript errors — fix before finishing:\n%s' "$out" | /usr/bin/jq -Rs .)"
fi
exit 0
