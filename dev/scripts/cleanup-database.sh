#!/bin/sh
set -eu

psql --host postgres --username virtool --dbname postgres --set ON_ERROR_STOP=1 \
	--command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${VT_DEV_DATABASE}'" \
	--command "DROP DATABASE IF EXISTS \"${VT_DEV_DATABASE}\""
