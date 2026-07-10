#!/usr/bin/env bash
set -euo pipefail

# Serialize test stack access across git worktrees. The Docker compose project
# name is pinned to "virtool", so every worktree shares one stack and one
# bind-mounted /app. A single flock held across both "up" and "exec" prevents a
# sibling worktree from rebinding /app between our up and exec.
flock /tmp/virtool-test.lock bash -c '
  docker compose up -d test
  docker compose exec test uv run pytest "$@"
' bash "$@"
