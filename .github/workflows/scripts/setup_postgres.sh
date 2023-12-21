#!/bin/bash
set -e

export PGPASSWORD=virtool
psql -v ON_ERROR_STOP=1 --username "virtool" --dbname "virtool" --host "localhost" <<-EOSQL
	CREATE DATABASE openfga;
	GRANT ALL PRIVILEGES ON DATABASE openfga TO "virtool";
EOSQL
