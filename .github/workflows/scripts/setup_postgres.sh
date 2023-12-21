#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "virtool" --dbname "virtool" <<-EOSQL
	CREATE DATABASE openfga;
	GRANT ALL PRIVILEGES ON DATABASE openfga TO "virtool";
EOSQL