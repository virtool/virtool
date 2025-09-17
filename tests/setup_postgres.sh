#!/bin/bash
set -e

# The official postgres image runs this as the postgres superuser
# and sets PGPASSWORD automatically from POSTGRES_PASSWORD
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER openfga WITH PASSWORD 'openfga';
	CREATE DATABASE openfga;
	GRANT ALL PRIVILEGES ON DATABASE openfga TO openfga;
	GRANT ALL PRIVILEGES ON DATABASE virtool TO openfga;
EOSQL
