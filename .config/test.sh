#!/usr/bin/env bash
set -euo pipefail

# Serialize test stack access across git worktrees. The Docker compose project
# name is pinned to "virtool", so every worktree shares one stack and one
# bind-mounted /app. A single flock held across both "up" and "exec" prevents a
# sibling worktree from rebinding /app between our up and exec.

# When VT_TEST_PARALLEL is set, run pytest under xdist with half the host's
# cores (floored at 1). Falls back to 2 cores if nproc is unavailable.
worker_args=()
if [ -n "${VT_TEST_PARALLEL:-}" ]; then
  cores=$(nproc 2>/dev/null || echo 2)
  workers=$(( cores / 2 ))
  (( workers < 1 )) && workers=1
  worker_args=(-n "$workers")
fi

flock /tmp/virtool-test.lock bash -c '
  set -euo pipefail
  docker compose up -d test
  docker compose exec test uv run pytest "$@"
' bash "${worker_args[@]}" "$@"
