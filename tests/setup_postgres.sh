#!/bin/bash
set -e

export PGPASSWORD=virtool
psql -v ON_ERROR_STOP=1 --username "postgres" --host "localhost" <<-EOSQL
  CREATE USER openfga WITH PASSWORD 'openfga';
	CREATE DATABASE openfga;
	GRANT ALL PRIVILEGES ON DATABASE openfga TO "virtool";
	CREATE DATABASE virtool;
	GRANT ALL PRIVILEGES ON DATABASE virtool TO "openfga";
EOSQL
