#!/bin/bash

# Report the shared dev cluster's status: whether Minikube is running, and
# for every worktree slug found either as a git worktree or as a namespace
# in the cluster, whether each side still exists and whether its Tilt server
# is running. A namespace with no matching worktree means removal never
# tore it down, whether by `wt remove` failing its pre-remove hook or by a
# worktree that predates that hook.

set -e

source "$(dirname "$0")/lib.sh"

if command -v ss >/dev/null; then
    is_port_listening() {
        local port="$1"

        ss -H -ltn | awk -v port=":$port" 'substr($4, length($4) - length(port) + 1) == port { found = 1 } END { exit found ? 0 : 1 }'
    }
elif command -v lsof >/dev/null; then
    is_port_listening() {
        lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
    }
else
    echo "Cannot check Tilt ports: 'ss' or 'lsof' is required." >&2
    exit 1
fi

# Mirrors the default slug in lib.sh's wt_slug, but a worktree brought up
# with a custom WT will show under its directory name here instead.
slug_for() {
    local raw
    raw=$(basename "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g')
    raw=${raw:0:63}
    printf '%s' "$raw" | sed -E 's/^-+//; s/-+$//'
}

is_reserved_namespace() {
    local candidate="$1"
    local reserved

    for reserved in "${WT_RESERVED_NAMESPACES[@]}"; do
        if [[ "$candidate" == "$reserved" ]]; then
            return 0
        fi
    done
    return 1
}

if minikube status >/dev/null 2>&1; then
    MINIKUBE_STATUS="up"
else
    MINIKUBE_STATUS="down"
fi
echo "Minikube: $MINIKUBE_STATUS"
echo

declare -A WORKTREE_FOR_SLUG
while IFS= read -r worktree; do
    WORKTREE_FOR_SLUG[$(slug_for "$worktree")]="$worktree"
done < <(git worktree list --porcelain | sed -n 's/^worktree //p')

declare -A NAMESPACE_EXISTS
if [[ "$MINIKUBE_STATUS" == "up" && "$(kubectl config current-context 2>/dev/null)" == "minikube" ]]; then
    while IFS= read -r namespace; do
        is_reserved_namespace "$namespace" || NAMESPACE_EXISTS[$namespace]=1
    done < <(kubectl get namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
fi

SLUGS=$( { printf '%s\n' "${!WORKTREE_FOR_SLUG[@]}"; printf '%s\n' "${!NAMESPACE_EXISTS[@]}"; } | sort -u)

{
    printf 'SLUG\tWORKTREE\tNAMESPACE\tTILT SERVER\n'
    while IFS= read -r slug; do
        [[ -z "$slug" ]] && continue

        worktree="${WORKTREE_FOR_SLUG[$slug]:-}"
        if [[ -n "${NAMESPACE_EXISTS[$slug]:-}" ]]; then
            ns_state="exists"
        else
            ns_state="missing"
        fi

        if [[ -n "$worktree" ]]; then
            wt_state="exists"
        else
            wt_state="removed"
        fi

        tilt_state="n/a"
        if [[ -n "$worktree" ]]; then
            port_file="$worktree/.TILT_PORT"
            if [[ -f "$port_file" ]]; then
                port=$(tr -d '[:space:]' < "$port_file")
                if is_port_listening "$port"; then
                    tilt_state="up (port $port)"
                else
                    tilt_state="down (port $port)"
                fi
            else
                tilt_state="never started"
            fi
        fi

        printf '%s\t%s\t%s\t%s\n' "$slug" "$wt_state" "$ns_state" "$tilt_state"
    done <<< "$SLUGS"
} | column -t -s $'\t'

if [[ "$MINIKUBE_STATUS" == "up" ]]; then
    for slug in "${!NAMESPACE_EXISTS[@]}"; do
        if [[ -z "${WORKTREE_FOR_SLUG[$slug]:-}" ]]; then
            echo
            echo "Orphaned namespace(s) with no matching worktree: run 'mise run destroy' with WT set to reclaim them."
            break
        fi
    done
fi
