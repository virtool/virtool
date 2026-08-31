#!/bin/bash

# Shared helpers for the per-worktree dev scripts.

# Print the namespace slug for this worktree. Source order: an explicit
# argument, then `$WT`, then the worktree directory name. The result is a valid
# DNS-1123 label — lowercased, non-alphanumerics collapsed to hyphens, trimmed
# to 63 characters with no leading or trailing hyphen. Set `WT` to a short,
# memorable slug; the directory-name fallback can be long and truncated.
wt_slug() {
    local raw="${1:-${WT:-}}"
    if [[ -z "$raw" ]]; then
        raw=$(basename "$(git rev-parse --show-toplevel)")
    fi
    raw=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g')
    raw=${raw:0:63}
    printf '%s' "$raw" | sed -E 's/^-+//; s/-+$//'
}
