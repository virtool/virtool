#!/bin/bash
set -e

source "$(dirname "$0")/lib.sh"

require_minikube_context

if ! minikube status >/dev/null 2>&1; then
    echo "Refusing to wipe: Minikube is not running."
    exit 1
fi

NS=$(wt_slug "$1")

echo "Deleting StatefulSets in namespace '$NS'..."
kubectl -n "$NS" delete statefulset azurite postgres --ignore-not-found

echo "Deleting PVCs in namespace '$NS'..."
kubectl -n "$NS" delete pvc \
    data-azurite-0 \
    data-postgres-0 \
    --ignore-not-found

echo "Done. Tilt will recreate resources on next trigger."
