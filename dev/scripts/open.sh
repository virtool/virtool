#!/bin/bash

# Open a URL in the default browser. Used by the Tilt 'worktree' nav button.
set -e

URL="$1"

if command -v xdg-open >/dev/null; then
    xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null; then
    open "$URL"
else
    echo "No browser opener found (tried xdg-open, open)." >&2
    exit 1
fi
