#!/bin/bash

# Report the shared dev cluster's status: whether Minikube is running, and
# for each worktree's namespace, whether it exists in the cluster and
# whether its Tilt server is running.

set -e

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

if minikube status >/dev/null 2>&1; then
    MINIKUBE_STATUS="up"
else
    MINIKUBE_STATUS="down"
fi
echo "Minikube: $MINIKUBE_STATUS"
echo

NAMESPACES=""
if [[ "$MINIKUBE_STATUS" == "up" && "$(kubectl config current-context 2>/dev/null)" == "minikube" ]]; then
    NAMESPACES=" $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}') "
fi

printf '%-25s %-10s %s\n' "NAMESPACE" "IN TILT" "TILT SERVER"
while IFS= read -r worktree; do
    slug=$(slug_for "$worktree")

    if [[ "$NAMESPACES" == *" $slug "* ]]; then
        ns_state="exists"
    else
        ns_state="missing"
    fi

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

    printf '%-25s %-10s %s\n' "$slug" "$ns_state" "$tilt_state"
done < <(git worktree list --porcelain | sed -n 's/^worktree //p')
