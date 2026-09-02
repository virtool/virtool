#!/bin/bash

# Shared helpers for the per-worktree dev scripts.

# Namespaces holding shared, cluster-wide resources. A worktree slug must never
# resolve to one of these, or bring-up and teardown would clobber resources
# every worktree depends on.
WT_RESERVED_NAMESPACES=(
    default
    ingress-nginx
    keda
    kube-node-lease
    kube-public
    kube-system
)

# Print the namespace slug for this worktree. Source order: an explicit
# argument, then `$WT`, then the slug pinned in `.WT` by a prior `up.sh` run,
# then the worktree directory name. The result is a valid DNS-1123 label —
# lowercased, non-alphanumerics collapsed to hyphens, trimmed to 63 characters
# with no leading or trailing hyphen. Set `WT` to a short, memorable slug; the
# directory-name fallback can be long and truncated. Exits non-zero if the
# slug is empty or names a reserved shared namespace.
wt_slug() {
    local raw="${1:-${WT:-}}"
    if [[ -z "$raw" ]]; then
        local repo_root
        repo_root=$(git rev-parse --show-toplevel)
        if [[ -f "$repo_root/.WT" ]]; then
            raw=$(tr -d '[:space:]' < "$repo_root/.WT")
        else
            raw=$(basename "$repo_root")
        fi
    fi
    raw=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g')
    raw=${raw:0:63}
    raw=$(printf '%s' "$raw" | sed -E 's/^-+//; s/-+$//')

    if [[ -z "$raw" ]]; then
        echo "Worktree slug is empty after normalization. Set WT to a value with alphanumeric characters." >&2
        return 1
    fi

    local reserved
    for reserved in "${WT_RESERVED_NAMESPACES[@]}"; do
        if [[ "$raw" == "$reserved" ]]; then
            echo "Worktree slug '$raw' is a reserved shared namespace. Set WT to a different slug." >&2
            return 1
        fi
    done

    printf '%s' "$raw"
}

# Exit non-zero unless the current kubectl context is Minikube. Guards
# destructive operations from running against another cluster.
require_minikube_context() {
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || true)
    if [[ "$current_context" != "minikube" ]]; then
        echo "Refusing to run: kubectl current-context is '${current_context:-<none>}', expected 'minikube'." >&2
        echo "Switch contexts with: kubectl config use-context minikube" >&2
        return 1
    fi
}
