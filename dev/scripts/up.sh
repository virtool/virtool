#!/bin/bash

# Bring up this worktree's dev instance in its own namespace. Creates the
# namespace, installs the shared wildcard certificate into it, then starts
# Tilt. Set `WT` to name the namespace, or let it default to the worktree
# directory name. Extra arguments pass through as Tilt live-edit flags, e.g.
# `bash dev/scripts/up.sh --web --internal`.

set -e

source "$(dirname "$0")/lib.sh"

REPO_ROOT=$(git rev-parse --show-toplevel)
TILT_PORT_FILE="$REPO_ROOT/.TILT_PORT"

CERT_STORE="${XDG_DATA_HOME:-$HOME/.local/share}/virtool-dev"

if [[ ! -f "$CERT_STORE/cert.pem" || ! -f "$CERT_STORE/key.pem" ]]; then
    echo "No wildcard certificate and key found. Run 'bash dev/scripts/init.sh' first."
    exit 1
fi

NS=$(wt_slug)
echo "Bringing up worktree instance in namespace '$NS'..."

MINIKUBE_IP=$(minikube ip)
DEV_URL="https://${NS}.${MINIKUBE_IP}.nip.io"
printf 'Dev URL: \033]8;;%s\033\\%s\033]8;;\033\\\n' "$DEV_URL" "$DEV_URL"

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret tls mkcert \
    --cert "$CERT_STORE/cert.pem" \
    --key "$CERT_STORE/key.pem" \
    -n "$NS" --dry-run=client -o yaml | kubectl apply -f -

if ! command -v ss >/dev/null; then
    echo "Cannot choose a Tilt port: 'ss' is required to check listening ports." >&2
    exit 1
fi

is_tilt_port_available() {
    local port="$1"

    ! ss -H -ltn | awk -v port=":$port" 'substr($4, length($4) - length(port) + 1) == port { found = 1 } END { exit found ? 0 : 1 }'
}

is_tilt_port_reserved() {
    local candidate="$1"
    local worktree
    local port_file
    local reserved_port

    while IFS= read -r worktree; do
        port_file="$worktree/.TILT_PORT"
        if [[ -f "$port_file" ]]; then
            reserved_port=$(tr -d '[:space:]' < "$port_file")
            if [[ "$reserved_port" == "$candidate" && "$port_file" != "$TILT_PORT_FILE" ]]; then
                return 0
            fi
        fi
    done < <(git worktree list --porcelain | sed -n 's/^worktree //p')

    return 1
}

find_tilt_port() {
    local candidate
    local offset
    local start

    start=$((RANDOM % 21))
    for ((offset = 0; offset < 21; offset++)); do
        candidate=$((10350 + (start + offset) % 21))
        if is_tilt_port_available "$candidate" && ! is_tilt_port_reserved "$candidate"; then
            echo "$candidate"
            return 0
        fi
    done

    echo "No available Tilt port found in the range 10350-10370." >&2
    return 1
}

if [[ -f "$TILT_PORT_FILE" ]]; then
    TILT_PORT=$(tr -d '[:space:]' < "$TILT_PORT_FILE")
    if [[ ! "$TILT_PORT" =~ ^[0-9]+$ || "$TILT_PORT" -lt 10350 || "$TILT_PORT" -gt 10370 ]]; then
        echo "Invalid Tilt port in '$TILT_PORT_FILE': '$TILT_PORT'. Use a port from 10350-10370." >&2
        exit 1
    fi
    if ! is_tilt_port_available "$TILT_PORT"; then
        echo "Pinned Tilt port $TILT_PORT from '$TILT_PORT_FILE' is already in use." >&2
        echo "Stop the existing Tilt instance or edit '$TILT_PORT_FILE' to an unused port from 10350-10370." >&2
        exit 1
    fi
    if is_tilt_port_reserved "$TILT_PORT"; then
        echo "Pinned Tilt port $TILT_PORT from '$TILT_PORT_FILE' is reserved by another worktree." >&2
        echo "Edit '$TILT_PORT_FILE' to an unused port from 10350-10370." >&2
        exit 1
    fi
else
    TILT_PORT=$(find_tilt_port)
    printf '%s\n' "$TILT_PORT" > "$TILT_PORT_FILE"
    echo "Pinned Tilt port $TILT_PORT in $TILT_PORT_FILE."
fi

echo "Starting Tilt on port $TILT_PORT..."
exec env WT="$NS" tilt up --port "$TILT_PORT" -- "$@"
