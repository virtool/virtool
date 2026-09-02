#!/bin/bash

# Tear down this worktree's workloads while retaining its Postgres and Azurite
# PVCs. Other worktrees and shared cluster resources are untouched. Pass a slug
# or set `WT` to target a namespace other than this worktree's default.

set -e

source "$(dirname "$0")/lib.sh"

require_minikube_context

NS=$(wt_slug "$1")
echo "Tearing down workloads in namespace '$NS'..."

kubectl -n "$NS" delete all,scaledjob,ingress,configmap --all --ignore-not-found

echo "Done. Data PVCs and the namespace were retained."
