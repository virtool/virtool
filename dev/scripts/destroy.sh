#!/bin/bash

# Delete this worktree's namespace and everything in it, including its data.
# Other worktrees and shared cluster resources are untouched.

set -e

source "$(dirname "$0")/lib.sh"

require_minikube_context

NS=$(wt_slug "$1")
echo "Destroying worktree instance in namespace '$NS'..."

kubectl delete namespace "$NS" --ignore-not-found

echo "Done. Other worktrees are unaffected."
