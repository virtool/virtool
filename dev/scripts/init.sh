#!/bin/bash

# One-time, cluster-wide setup shared by every worktree. It starts Minikube,
# installs the singletons — metrics-server, the ingress addon and KEDA — and
# issues one wildcard `*.<minikube-ip>.nip.io` certificate that every
# worktree's ingress reuses. Per-worktree bring-up is `dev/scripts/up.sh`.
#
# Safe to re-run. It does not delete the cluster or any data; run
# `minikube delete` by hand for a clean slate. Re-run it after a cluster
# recreate to refresh the certificate against the new Minikube IP.

set -e

CERT_STORE="${XDG_DATA_HOME:-$HOME/.local/share}/virtool-dev"

echo "Starting Minikube..."
if ! minikube status >/dev/null 2>&1; then
    minikube start --cpus 8 --memory 16000
fi

echo "Enabling metrics-server addon..."
minikube addons enable metrics-server

echo "Installing KEDA..."
helm repo add kedacore https://kedacore.github.io/charts >/dev/null
helm repo update kedacore >/dev/null
helm upgrade --install keda kedacore/keda \
    --namespace keda \
    --create-namespace \
    --version 2.20.2

MINIKUBE_IP=$(minikube ip)

echo "Generating wildcard TLS certificate for *.${MINIKUBE_IP}.nip.io..."
echo "Run 'mkcert -install' once beforehand so the certificate is trusted."
mkdir -p "$CERT_STORE"
rm -f "$CERT_STORE/key.pem" "$CERT_STORE/cert.pem"
mkcert \
    -key-file "$CERT_STORE/key.pem" \
    -cert-file "$CERT_STORE/cert.pem" \
    "*.${MINIKUBE_IP}.nip.io"

echo "Installing the certificate as the ingress controller's default..."
kubectl -n kube-system create secret tls mkcert \
    --key "$CERT_STORE/key.pem" \
    --cert "$CERT_STORE/cert.pem" \
    --dry-run=client -o yaml | kubectl apply -f -

echo "Configuring ingress addon to use the certificate..."
# The second line answers the "overwrite existing cert? [y/n]" prompt that
# minikube adds only when a custom cert is already set; on a first run there is
# no such prompt and the extra line is harmlessly ignored.
printf 'kube-system/mkcert\ny\n' | minikube addons configure ingress
minikube addons enable ingress

echo "Done. Start a worktree instance with: bash dev/scripts/up.sh"
