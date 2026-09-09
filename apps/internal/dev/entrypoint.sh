#!/bin/sh
set -eu

dev_uid=$(stat -c %u /repo/apps/internal/src)
dev_gid=$(stat -c %g /repo/apps/internal/src)
mkdir -p /tmp/virtool-home /repo/apps/internal/dist
chown "$dev_uid:$dev_gid" /tmp/virtool-home /repo/apps/internal/dist

if [ "$1" = migrate ]; then
    exec setpriv --reuid="$dev_uid" --regid="$dev_gid" --clear-groups env HOME=/tmp/virtool-home \
        sh -ec 'pnpm build && exec node --import @sentry/node/preload dist/index.mjs migrate'
fi

exec setpriv --reuid="$dev_uid" --regid="$dev_gid" --clear-groups env HOME=/tmp/virtool-home \
    node dev/main.ts "$1"
