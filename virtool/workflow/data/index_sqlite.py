"""Build and query workflow-local SQLite index artifacts."""

import asyncio
from collections.abc import Iterable, Iterator, Mapping
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from typing import Any

from sqlalchemy import (
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    event,
    insert,
)
from sqlalchemy.engine import URL, Connection, Engine
from sqlalchemy.pool import ConnectionPoolEntry

from virtool.api.custom_json import datetime_to_isoformat

INDEX_SQLITE_FORMAT = "virtool-index-sqlite"
INDEX_SQLITE_FORMAT_VERSION = "1"
INDEX_SQLITE_FILE_NAME = f"{INDEX_SQLITE_FORMAT}-v{INDEX_SQLITE_FORMAT_VERSION}.sqlite"

index_sqlite_metadata = MetaData()

metadata_table = Table(
    "metadata",
    index_sqlite_metadata,
    Column("key", Text, primary_key=True),
    Column("value", Text, nullable=False),
)

reference_table = Table(
    "reference",
    index_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("created_at", Text, nullable=False),
    Column("data_type", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("organism", Text, nullable=False),
)

otus_table = Table(
    "otus",
    index_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("reference_id", Text, ForeignKey("reference.id")),
    Column("abbreviation", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("taxid", Integer),
    Column("version", Integer, nullable=False),
)

otu_schema_table = Table(
    "otu_schema",
    index_sqlite_metadata,
    Column("otu_id", Text, ForeignKey("otus.id"), primary_key=True),
    Column("name", Text, primary_key=True),
    Column("molecule", Text),
    Column("required", Integer, nullable=False),
)

isolates_table = Table(
    "isolates",
    index_sqlite_metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("virtool_id", Text, nullable=False),
    Column("otu_id", Text, ForeignKey("otus.id"), nullable=False),
    Column("source_type", Text, nullable=False),
    Column("source_name", Text, nullable=False),
    Column("is_default", Integer, nullable=False),
    UniqueConstraint("otu_id", "virtool_id"),
)

sequences_table = Table(
    "sequences",
    index_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("isolate_id", Integer, ForeignKey("isolates.id"), nullable=False),
    Column("accession", Text, nullable=False),
    Column("definition", Text, nullable=False),
    Column("host", Text, nullable=False),
    Column("segment", Text),
    Column("sequence", Text, nullable=False),
)

Index("isolates_otu_id_idx", isolates_table.c.otu_id)
Index("sequences_isolate_id_idx", sequences_table.c.isolate_id)
Index("sequences_segment_idx", sequences_table.c.segment)


def create_index_sqlite_engine(path: Path) -> Engine:
    """Create an engine for an index SQLite artifact."""
    engine = create_engine(URL.create("sqlite", database=str(path)))
    event.listen(engine, "connect", _enable_index_sqlite_foreign_keys)

    return engine


@contextmanager
def connect_index_sqlite(path: Path) -> Iterator[Connection]:
    """Yield a configured connection to an index SQLite artifact."""
    engine = create_index_sqlite_engine(path)

    try:
        with engine.connect() as connection:
            yield connection
    finally:
        engine.dispose()


def _enable_index_sqlite_foreign_keys(
    dbapi_connection: SQLiteConnection,
    _connection_record: ConnectionPoolEntry,
) -> None:
    cursor = dbapi_connection.cursor()

    try:
        cursor.execute("PRAGMA foreign_keys = ON")
    finally:
        cursor.close()


async def create_index_sqlite(
    path: Path,
    reference: Mapping[str, Any] | None,
    otus: Iterable[Mapping[str, Any]],
) -> None:
    """Create a SQLite structured index artifact at ``path``."""
    await asyncio.to_thread(_create_index_sqlite, path, reference, otus)


def _create_index_sqlite(
    path: Path,
    reference: Mapping[str, Any] | None,
    otus: Iterable[Mapping[str, Any]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        path.unlink()

    with connect_index_sqlite(path) as connection, connection.begin():
        index_sqlite_metadata.create_all(connection)
        _insert_metadata(connection)
        reference_id = (
            _insert_reference(connection, reference) if reference is not None else None
        )

        for otu in otus:
            _insert_otu(connection, reference_id, otu)


def _insert_metadata(connection: Connection) -> None:
    connection.execute(
        insert(metadata_table),
        [
            {"key": "format", "value": INDEX_SQLITE_FORMAT},
            {"key": "format_version", "value": INDEX_SQLITE_FORMAT_VERSION},
            {"key": "created_by", "value": "virtool"},
        ],
    )


def _insert_reference(connection: Connection, reference: Mapping[str, Any]) -> str:
    reference_id = _get_id(reference)
    created_at = reference["created_at"]

    if isinstance(created_at, datetime):
        created_at = datetime_to_isoformat(created_at)

    connection.execute(
        insert(reference_table),
        {
            "id": reference_id,
            "created_at": created_at,
            "data_type": reference["data_type"],
            "name": reference["name"],
            "organism": reference["organism"],
        },
    )

    return reference_id


def _insert_otu(
    connection: Connection,
    reference_id: str | None,
    otu: Mapping[str, Any],
) -> None:
    otu_id = _get_id(otu)
    schema = otu.get("schema", [])

    connection.execute(
        insert(otus_table),
        {
            "id": otu_id,
            "reference_id": reference_id,
            "abbreviation": otu.get("abbreviation", ""),
            "name": otu["name"],
            "taxid": otu.get("taxid"),
            "version": otu["version"],
        },
    )

    if schema:
        connection.execute(
            insert(otu_schema_table),
            [
                {
                    "otu_id": otu_id,
                    "name": item["name"],
                    "molecule": item.get("molecule"),
                    "required": int(item.get("required", True)),
                }
                for item in schema
            ],
        )

    for isolate in otu["isolates"]:
        _insert_isolate(connection, otu_id, isolate)


def _insert_isolate(
    connection: Connection,
    otu_id: str,
    isolate: Mapping[str, Any],
) -> None:
    virtool_id = _get_id(isolate)

    isolate_id = connection.execute(
        insert(isolates_table).returning(isolates_table.c.id),
        {
            "virtool_id": virtool_id,
            "otu_id": otu_id,
            "source_type": isolate["source_type"],
            "source_name": isolate["source_name"],
            "is_default": int(isolate["default"]),
        },
    ).scalar_one()

    for sequence in isolate["sequences"]:
        _insert_sequence(connection, isolate_id, sequence)


def _insert_sequence(
    connection: Connection,
    isolate_id: int,
    sequence: Mapping[str, Any],
) -> None:
    sequence_id = _get_id(sequence)
    segment = sequence.get("segment")

    connection.execute(
        insert(sequences_table),
        {
            "id": sequence_id,
            "isolate_id": isolate_id,
            "accession": sequence["accession"],
            "definition": sequence["definition"],
            "host": sequence["host"],
            "segment": segment,
            "sequence": sequence["sequence"],
        },
    )


def _get_id(document: Mapping[str, Any]) -> str:
    return document["_id"] if "_id" in document else document["id"]
