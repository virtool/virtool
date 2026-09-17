#!/bin/sh
set -eu

database="${VT_DEV_DATABASE}"
if ! psql --host postgres --username virtool --dbname postgres --tuples-only --no-align \
	--command "SELECT 1 FROM pg_database WHERE datname = '${database}'" | grep -q 1; then
	createdb --host postgres --username virtool "${database}"
fi

printf 'postgres://virtool:virtool@postgres:5432/%s' "${database}" > /run/virtool-dev/postgres-url
chmod 600 /run/virtool-dev/postgres-url
