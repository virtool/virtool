#!/bin/sh
set -eu

config_dir=/run/virtool-dev

# Keep identity in the instance volume, independent of its currently assigned
# worktree and of the app containers that Compose may replace on rebuild.
if [ ! -s "$config_dir/namespace" ]; then
    printf 'vt%s\n' "$(tr -d '-' < /proc/sys/kernel/random/uuid)" > "$config_dir/namespace.tmp"
    mv "$config_dir/namespace.tmp" "$config_dir/namespace"
fi

data_id=$(cat "$config_dir/namespace")
if ! printf '%s\n' "$data_id" | grep -Eq '^vt[0-9a-f]{32}$'; then
    echo "Invalid instance data ID in $config_dir/namespace" >&2
    exit 1
fi

for attempt in $(seq 1 60); do
    if pg_isready -q; then
        break
    fi
    sleep 2
done

psql --no-psqlrc --set=ON_ERROR_STOP=1 --set=database="$data_id" <<'SQL'
SELECT format('CREATE DATABASE %I', :'database')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')
\gexec
SQL

printf 'postgres://virtool:virtool@postgres:5432/%s\n' "$data_id" > "$config_dir/postgres-url.tmp"
mv "$config_dir/postgres-url.tmp" "$config_dir/postgres-url"
echo "Instance data ID: $data_id"
