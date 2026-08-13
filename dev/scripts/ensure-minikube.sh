#!/bin/bash

set -e

if minikube status >/dev/null 2>&1; then
    echo "Minikube is already running."
else
    echo "Minikube is not running. Starting..."
    minikube start --cpus 8 --memory 16000
fi
