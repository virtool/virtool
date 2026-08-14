#!/bin/bash
set -e

current_context=$(kubectl config current-context 2>/dev/null || true)
if [[ "$current_context" != "minikube" ]]; then
    echo "Refusing to wipe: kubectl current-context is '${current_context:-<none>}', expected 'minikube'."
    echo "Switch contexts with: kubectl config use-context minikube"
    exit 1
fi

if ! minikube status >/dev/null 2>&1; then
    echo "Refusing to wipe: Minikube is not running."
    exit 1
fi

echo "Deleting StatefulSets..."
kubectl delete statefulset azurite postgres --ignore-not-found

echo "Deleting PVCs..."
kubectl delete pvc \
    data-azurite-0 \
    data-postgres-0 \
    --ignore-not-found

echo "Done. Tilt will recreate resources on next trigger."
