#!/bin/bash

# Without pipefail a failing curl is masked by the jq and sed that follow it,
# and the tag check below reports a missing release where the truth is a dead
# network or a spent rate limit.
set -o pipefail

# Manifest paths are resolved from this script's own location rather than the
# working directory. Tilt's Pull button runs it from dev/, a person running it
# by hand is as likely to be at the repo root.
MANIFESTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/manifests"

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to use this script."
    exit 1
fi

# The API is called unauthenticated, so it is rate limited at 60 requests an
# hour and answers a spent budget with a JSON error object and a 403. `curl -s`
# reports that as success and `.tag_name` comes back `null`, so without `-f` and
# the checks below a rate-limited run rewrites every manifest to `null`.
fetch_latest_tag() {
    local repo=$1
    local url="https://api.github.com/repos/${repo}/releases/latest"
    local tag

    if ! tag=$(curl -fsS "$url" | jq -r '.tag_name' | sed 's/^v//'); then
        echo "Error: could not fetch the latest release of $repo." >&2
        exit 1
    fi

    if [[ -z "$tag" || "$tag" == "null" ]]; then
        echo "Error: $repo reported no latest release tag." >&2
        exit 1
    fi

    echo "$tag"
}

# The old tag is matched as a run of non-space characters rather than as
# `[0-9.]+`. jobs-api and tasks ship pinned to `latest`, which has no digits in
# it, so a numeric pattern left them there while still reporting success — and
# the whole point of this script is that every service runs one release.
update_tag() {
    local file=$1
    local prefix=$2
    local tag=$3

    if [[ ! -f "$file" ]]; then
        echo "Error: File $file not found." >&2
        exit 1
    fi

    sed -i.bak "s|${prefix}[^[:space:]]\+|${prefix}${tag}|" "$file" && rm "${file}.bak"

    if ! grep -qF "${prefix}${tag}" "$file"; then
        echo "Error: no '${prefix}' tag to rewrite in $file." >&2
        exit 1
    fi

    echo "Using tag '$tag' for $file"
}

echo "Server"
echo ""

# migration hasn't been ported to the virtool-ui monorepo yet, so it still
# versions off the virtool python monolith's releases.
virtool_tag=$(fetch_latest_tag "virtool/virtool")
update_tag "$MANIFESTS/migration.yaml" "ghcr.io/virtool/virtool:" "$virtool_tag"

# web, jobs-api, tasks, and all four workflows now build from virtool-ui, so
# one release tag covers all of them.
ui_tag=$(fetch_latest_tag "virtool/virtool-ui")
update_tag "$MANIFESTS/web/kustomization.yaml" "newTag: " "$ui_tag"
update_tag "$MANIFESTS/virtool/jobs-api/kustomization.yaml" "newTag: " "$ui_tag"
update_tag "$MANIFESTS/virtool/tasks/kustomization.yaml" "newTag: " "$ui_tag"

echo ""
echo "Workflows"
echo ""

for workflow in "create-sample" "create-subtraction" "nuvs" "pathoscope"; do
    update_tag "$MANIFESTS/workflows/${workflow}.yaml" "${workflow}:" "$ui_tag"
done
