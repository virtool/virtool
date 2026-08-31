#!/bin/bash

# Tear down this worktree's dev instance. Deletes the namespace and everything
# in it, including the Postgres and Azurite data. Other worktrees, KEDA, the
# ingress controller and the shared certificate are untouched. Pass a slug or
# set `WT` to target a namespace other than this worktree's default.

set -e

source "$(dirname "$0")/lib.sh"

require_minikube_context

NS=$(wt_slug "$1")
echo "Tearing down worktree instance in namespace '$NS'..."

kubectl delete namespace "$NS" --ignore-not-found

echo "Done. Other worktrees are unaffected."
