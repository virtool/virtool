#!/bin/bash

# Bring up this worktree's dev instance in its own namespace. Creates the
# namespace, installs the shared wildcard certificate into it, then starts
# Tilt. Set `WT` to name the namespace, or let it default to the worktree
# directory name. Extra arguments pass through as Tilt live-edit flags, e.g.
# `bash dev/scripts/up.sh --web --internal`.

set -e

source "$(dirname "$0")/lib.sh"

CERT_STORE="${XDG_DATA_HOME:-$HOME/.local/share}/virtool-dev"

if [[ ! -f "$CERT_STORE/cert.pem" ]]; then
    echo "No wildcard certificate found. Run 'bash dev/scripts/init.sh' first."
    exit 1
fi

NS=$(wt_slug)
echo "Bringing up worktree instance in namespace '$NS'..."

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret tls mkcert \
    --cert "$CERT_STORE/cert.pem" \
    --key "$CERT_STORE/key.pem" \
    -n "$NS" --dry-run=client -o yaml | kubectl apply -f -

exec env WT="$NS" tilt up --port 0 -- "$@"
