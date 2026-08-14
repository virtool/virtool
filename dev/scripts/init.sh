#!/bin/bash

set -e

echo "Deleting any existing Minikube cluster..."
minikube delete --purge=true

echo "Starting Minikube for first time..."
minikube start --cpus 8 --memory 16000

echo "Enabling Minikube addons..."
minikube addons enable metrics-server

echo "Generating TLS certificate for virtool.local..."
CERT_DIR=$(mktemp -d)
mkcert -key-file "$CERT_DIR/key.pem" -cert-file "$CERT_DIR/cert.pem" virtool.local

echo "Creating TLS secrets..."
kubectl -n kube-system create secret tls mkcert \
    --key "$CERT_DIR/key.pem" \
    --cert "$CERT_DIR/cert.pem"
kubectl create secret tls mkcert \
    --key "$CERT_DIR/key.pem" \
    --cert "$CERT_DIR/cert.pem"

echo "Cleaning up temporary certificate files..."
rm -rf "$CERT_DIR"

echo "Configuring ingress addon to use custom certificate..."
minikube addons configure ingress <<< "kube-system/mkcert"
minikube addons enable ingress

echo "Verifying ingress configuration..."
kubectl -n ingress-nginx get deployment ingress-nginx-controller -o yaml | grep "kube-system"

echo "Configuring /etc/hosts..."
MINIKUBE_IP=$(minikube ip)
sudo sed -i '/virtool.local/d' /etc/hosts
echo -e "$MINIKUBE_IP\tvirtool.local" | sudo tee -a /etc/hosts
