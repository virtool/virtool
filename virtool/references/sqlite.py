"""Build and query portable SQLite reference artifacts."""

from collections.abc import (
    AsyncIterator,
    Callable,
    Iterable,
    Mapping,
)
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, TypedDict

from sqlalchemy import (
    JSON,
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
    case,
    event,
    func,
    insert,
    inspect,
    literal,
    select,
    type_coerce,
)
from sqlalchemy.engine import URL, AdaptedConnection, Connection
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from sqlalchemy.pool import ConnectionPoolEntry
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement

REFERENCE_SQLITE_FILE_NAME = "reference-snapshot.v1.sqlite"
REFERENCE_SQLITE_FORMAT = "virtool-reference-sqlite"
REFERENCE_SQLITE_FORMAT_VERSION = "1"

_SQLITE_SEQUENCE_BATCH_SIZE = 500

reference_sqlite_metadata = MetaData()


class SQLiteReferenceReadError(ValueError):
    """Raised when a SQLite reference database cannot be read."""


class SQLiteReferenceWriteError(ValueError):
    """Raised when a SQLite reference database cannot be written."""


class OTUSummary(TypedDict):
    """Top-level OTU information excluding isolates and schema."""

    id: str
    abbreviation: str
    name: str
    taxid: int | None
    version: int


metadata_table = Table(
    "metadata",
    reference_sqlite_metadata,
    Column("key", Text, primary_key=True),
    Column("value", Text, nullable=False),
)

reference_table = Table(
    "reference",
    reference_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("created_at", Text, nullable=False),
    Column("data_type", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("organism", Text, nullable=False),
)

otus_table = Table(
    "otus",
    reference_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("reference_id", Text, ForeignKey("reference.id")),
    Column("abbreviation", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("taxid", Integer),
    Column("version", Integer, nullable=False),
)

otu_schema_table = Table(
    "otu_schema",
    reference_sqlite_metadata,
    Column("otu_id", Text, ForeignKey("otus.id"), primary_key=True),
    Column("name", Text, primary_key=True),
    Column("molecule", Text),
    Column("required", Integer, nullable=False),
)

isolates_table = Table(
    "isolates",
    reference_sqlite_metadata,
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
    reference_sqlite_metadata,
    Column("id", Text, primary_key=True),
    Column("isolate_id", Integer, ForeignKey("isolates.id"), nullable=False),
    Column("accession", Text, nullable=False),
    Column("definition", Text, nullable=False),
    Column("host", Text),
    Column("segment", Text),
    Column("sequence", Text, nullable=False),
)

Index("isolates_otu_id_idx", isolates_table.c.otu_id)
Index("sequences_isolate_id_idx", sequences_table.c.isolate_id)
Index("sequences_segment_idx", sequences_table.c.segment)


class SQLiteReference:
    """A portable reference stored in SQLite."""

    path: Path

    def __init__(self, path: Path) -> None:
        self.path = path

    @classmethod
    async def create(
        cls,
        path: Path,
        reference: Mapping[str, Any] | None,
        otus: Iterable[Mapping[str, Any]],
    ) -> "SQLiteReference":
        """Create a SQLite reference and return its path-backed representation."""
        sqlite_reference = cls(path)
        sqlite_reference.path.parent.mkdir(parents=True, exist_ok=True)

        if sqlite_reference.path.exists():
            raise FileExistsError(sqlite_reference.path)

        try:
            async with sqlite_reference._connect() as connection, connection.begin():
                await connection.run_sync(reference_sqlite_metadata.create_all)
                await _insert_metadata(connection)
                reference_id = (
                    await _insert_reference(connection, reference)
                    if reference is not None
                    else None
                )

                for otu in otus:
                    await _insert_otu(connection, reference_id, otu)
        except SQLAlchemyError as err:
            msg = "Could not write SQLite reference database"
            raise SQLiteReferenceWriteError(msg) from err

        return sqlite_reference

    @classmethod
    def load(cls, path: Path) -> "SQLiteReference":
        """Load an existing SQLite reference."""
        if not path.exists():
            raise FileNotFoundError(path)

        return cls(path)

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[AsyncConnection]:
        """Yield a configured connection to the SQLite reference."""
        engine = _create_reference_sqlite_engine(self.path)

        try:
            async with engine.connect() as connection:
                yield connection
        finally:
            await engine.dispose()

    async def validate(self) -> None:
        """Validate that this is a complete, compatible v1 SQLite reference."""
        try:
            async with self._connect() as connection:
                await connection.run_sync(_validate_reference_sqlite_schema)
                await _validate_reference_sqlite_metadata(connection)
        except ValueError:
            raise
        except SQLAlchemyError as err:
            msg = "Could not read SQLite reference database"
            raise SQLiteReferenceReadError(msg) from err

    async def get_metadata(self) -> dict[str, Any]:
        """Get reference metadata excluding OTUs."""
        try:
            async with self._connect() as connection:
                row = (
                    (await connection.execute(select(reference_table)))
                    .mappings()
                    .one_or_none()
                )
        except SQLAlchemyError as err:
            msg = "Could not read SQLite reference database"
            raise SQLiteReferenceReadError(msg) from err

        if row is None:
            msg = "Reference metadata does not exist in the SQLite reference"
            raise ValueError(msg)

        return dict(row)

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate complete OTUs in the reference."""
        async for otus in self._iter_query_batches(
            _select_otus(),
            1,
            "scalar",
            _validate_otu,
        ):
            for otu in otus:
                yield otu

    async def iter_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate sequences ordered by sequence ID."""
        async for sequence in self._iter_sequence_query(
            _select_sequences_with_isolates()
            .order_by(None)
            .order_by(sequences_table.c.id),
        ):
            yield sequence

    async def iter_default_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate sequences belonging to default isolates."""
        async for sequence in self._iter_sequence_query(
            _select_sequences_with_isolates().where(
                isolates_table.c.is_default == 1,
            ),
        ):
            yield sequence

    async def iter_otu_sequences(
        self,
        otu_ids: str | Iterable[str],
    ) -> AsyncIterator[dict[str, Any]]:
        """Iterate sequences belonging to the given OTU IDs."""
        otu_id_set = _normalize_otu_ids(otu_ids)

        if not otu_id_set:
            return

        async for sequence in self._iter_sequence_query(
            _select_sequences_with_isolates().where(
                isolates_table.c.otu_id.in_(otu_id_set),
            ),
        ):
            yield sequence

    async def get_otu_summaries_by_sequence_ids(
        self,
        sequence_ids: Iterable[str],
    ) -> dict[str, OTUSummary]:
        """Get top-level OTU information keyed by the given sequence IDs."""
        sequence_id_set = set(sequence_ids)

        if not sequence_id_set:
            return {}

        try:
            async with self._connect() as connection:
                rows = (
                    await connection.execute(
                        select(
                            sequences_table.c.id.label("sequence_id"),
                            otus_table.c.id.label("otu_id"),
                            otus_table.c.abbreviation,
                            otus_table.c.name,
                            otus_table.c.taxid,
                            otus_table.c.version,
                        )
                        .join(
                            isolates_table,
                            sequences_table.c.isolate_id == isolates_table.c.id,
                        )
                        .join(otus_table, isolates_table.c.otu_id == otus_table.c.id)
                        .where(sequences_table.c.id.in_(sequence_id_set)),
                    )
                ).mappings()
        except SQLAlchemyError as err:
            msg = "Could not read SQLite reference database"
            raise SQLiteReferenceReadError(msg) from err

        otu_ref_by_sequence_id = {
            row["sequence_id"]: {
                "id": row["otu_id"],
                "abbreviation": row["abbreviation"],
                "name": row["name"],
                "taxid": row["taxid"],
                "version": row["version"],
            }
            for row in rows
        }

        missing_sequence_ids = sequence_id_set - otu_ref_by_sequence_id.keys()

        if missing_sequence_ids:
            msg = "The sequence_id does not exist in the reference"
            raise ValueError(msg)

        return otu_ref_by_sequence_id

    async def _iter_sequence_query(
        self,
        query: Select,
    ) -> AsyncIterator[dict[str, Any]]:
        async for sequences in self._iter_query_batches(
            query,
            _SQLITE_SEQUENCE_BATCH_SIZE,
            "mapping",
            _shape_sequence,
        ):
            for sequence in sequences:
                yield sequence

    async def _iter_query_batches[T](
        self,
        query: Select,
        batch_size: int,
        row_mode: Literal["mapping", "scalar"],
        shape_row: Callable[[Any], T],
    ) -> AsyncIterator[list[T]]:
        """Iterate query results without blocking the event loop."""
        try:
            async with (
                self._connect() as connection,
                connection.stream(query) as result,
            ):
                if row_mode == "scalar":
                    async for partition in result.scalars().partitions(batch_size):
                        yield [shape_row(row) for row in partition]
                else:
                    async for partition in result.mappings().partitions(batch_size):
                        yield [shape_row(row) for row in partition]
        except SQLAlchemyError as err:
            msg = "Could not read SQLite reference database"
            raise SQLiteReferenceReadError(msg) from err


def _create_reference_sqlite_engine(path: Path) -> AsyncEngine:
    engine = create_async_engine(URL.create("sqlite+aiosqlite", database=str(path)))
    event.listen(
        engine.sync_engine,
        "connect",
        _enable_reference_sqlite_foreign_keys,
    )

    return engine


def _enable_reference_sqlite_foreign_keys(
    dbapi_connection: AdaptedConnection,
    _connection_record: ConnectionPoolEntry,
) -> None:
    cursor = dbapi_connection.cursor()

    try:
        cursor.execute("PRAGMA foreign_keys = ON")
    finally:
        cursor.close()


def _validate_reference_sqlite_schema(connection: Connection) -> None:
    inspector = inspect(connection)
    table_names = set(inspector.get_table_names())
    required_table_names = set(reference_sqlite_metadata.tables)
    missing_table_names = sorted(required_table_names - table_names)

    if missing_table_names:
        missing = ", ".join(missing_table_names)
        msg = f"SQLite reference schema is missing required tables: {missing}"
        raise ValueError(msg)

    for table_name, table in reference_sqlite_metadata.tables.items():
        column_names = {column["name"] for column in inspector.get_columns(table_name)}
        missing_column_names = sorted(set(table.c.keys()) - column_names)

        if missing_column_names:
            missing = ", ".join(missing_column_names)
            msg = (
                f"SQLite reference table {table_name!r} is missing required "
                f"columns: {missing}"
            )
            raise ValueError(msg)


async def _validate_reference_sqlite_metadata(connection: AsyncConnection) -> None:
    metadata = dict((await connection.execute(select(metadata_table))).all())

    if "format" not in metadata:
        msg = "SQLite reference metadata is missing 'format'"
        raise ValueError(msg)

    if metadata["format"] != REFERENCE_SQLITE_FORMAT:
        msg = f"Unsupported SQLite reference format: {metadata['format']!r}"
        raise ValueError(msg)

    if "format_version" not in metadata:
        msg = "SQLite reference metadata is missing 'format_version'"
        raise ValueError(msg)

    if metadata["format_version"] != REFERENCE_SQLITE_FORMAT_VERSION:
        msg = (
            "Unsupported SQLite reference format version: "
            f"{metadata['format_version']!r}"
        )
        raise ValueError(msg)

    reference_count = await connection.scalar(
        select(func.count()).select_from(reference_table),
    )

    if reference_count != 1:
        msg = (
            "SQLite reference must contain exactly one reference metadata row; "
            f"found {reference_count}"
        )
        raise ValueError(msg)


async def _insert_metadata(connection: AsyncConnection) -> None:
    await connection.execute(
        insert(metadata_table),
        [
            {"key": "format", "value": REFERENCE_SQLITE_FORMAT},
            {
                "key": "format_version",
                "value": REFERENCE_SQLITE_FORMAT_VERSION,
            },
            {"key": "created_by", "value": "virtool"},
        ],
    )


async def _insert_reference(
    connection: AsyncConnection,
    reference: Mapping[str, Any],
) -> str:
    reference_id = _get_id(reference)
    created_at = reference["created_at"]

    if isinstance(created_at, datetime):
        created_at = created_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")

    await connection.execute(
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


async def _insert_otu(
    connection: AsyncConnection,
    reference_id: str | None,
    otu: Mapping[str, Any],
) -> None:
    otu_id = _get_id(otu)
    schema = otu.get("schema", [])

    await connection.execute(
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
        await connection.execute(
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
        await _insert_isolate(connection, otu_id, isolate)


async def _insert_isolate(
    connection: AsyncConnection,
    otu_id: str,
    isolate: Mapping[str, Any],
) -> None:
    virtool_id = _get_id(isolate)

    isolate_id = (
        await connection.execute(
            insert(isolates_table).returning(isolates_table.c.id),
            {
                "virtool_id": virtool_id,
                "otu_id": otu_id,
                "source_type": isolate["source_type"],
                "source_name": isolate["source_name"],
                "is_default": int(isolate["default"]),
            },
        )
    ).scalar_one()

    sequences = isolate["sequences"]

    if sequences:
        await connection.execute(
            insert(sequences_table),
            [
                {
                    "id": _get_id(sequence),
                    "isolate_id": isolate_id,
                    "accession": sequence["accession"],
                    "definition": sequence["definition"],
                    "host": sequence["host"],
                    "segment": sequence.get("segment"),
                    "sequence": sequence["sequence"],
                }
                for sequence in sequences
            ],
        )


def _get_id(document: Mapping[str, Any]) -> str:
    return document["_id"] if "_id" in document else document["id"]


def _validate_otu(otu: dict[str, Any]) -> dict[str, Any]:
    otu_id = otu["id"]

    if not otu["isolates"]:
        msg = f"OTU {otu_id} has no isolates in the SQLite reference"
        raise ValueError(msg)

    for isolate in otu["isolates"]:
        if not isolate["sequences"]:
            msg = (
                f"Isolate {isolate['id']} in OTU {otu_id} has no sequences in the "
                "SQLite reference"
            )
            raise ValueError(msg)

    return otu


def _select_otus() -> Select:
    return select(
        type_coerce(
            func.json_object(
                "id",
                otus_table.c.id,
                "abbreviation",
                otus_table.c.abbreviation,
                "isolates",
                func.json(_select_isolates(otus_table.c.id)),
                "name",
                otus_table.c.name,
                "schema",
                func.json(_select_otu_schema(otus_table.c.id)),
                "taxid",
                otus_table.c.taxid,
                "version",
                otus_table.c.version,
            ),
            JSON,
        )
    ).order_by(otus_table.c.id)


def _normalize_otu_ids(otu_ids: str | Iterable[str]) -> set[str]:
    if isinstance(otu_ids, str):
        return {otu_ids}

    return set(otu_ids)


def _select_sequences_with_isolates() -> Select:
    return (
        select(
            sequences_table.c.id,
            sequences_table.c.isolate_id.label("isolate_internal_id"),
            sequences_table.c.accession,
            sequences_table.c.definition,
            sequences_table.c.host,
            isolates_table.c.virtool_id.label("isolate_virtool_id"),
            isolates_table.c.otu_id,
            sequences_table.c.segment,
            sequences_table.c.sequence,
        )
        .join(
            isolates_table,
            sequences_table.c.isolate_id == isolates_table.c.id,
        )
        .order_by(
            isolates_table.c.otu_id,
            isolates_table.c.virtool_id,
            sequences_table.c.id,
        )
    )


def _shape_sequence(sequence: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": sequence["id"],
        "accession": sequence["accession"],
        "definition": sequence["definition"],
        "host": sequence["host"],
        "isolate_id": sequence["isolate_virtool_id"],
        "otu_id": sequence["otu_id"],
        "segment": sequence["segment"],
        "sequence": sequence["sequence"],
    }


def _select_otu_schema(otu_id: ColumnElement[str]) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "molecule",
                        otu_schema_table.c.molecule,
                        "name",
                        otu_schema_table.c.name,
                        "required",
                        _json_bool(otu_schema_table.c.required),
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(otu_schema_table.c.otu_id == otu_id)
        .order_by(otu_schema_table.c.name)
        .scalar_subquery()
    )


def _select_isolates(otu_id: ColumnElement[str]) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "default",
                        _json_bool(isolates_table.c.is_default),
                        "id",
                        isolates_table.c.virtool_id,
                        "sequences",
                        func.json(_select_isolate_sequences(isolates_table.c.id)),
                        "source_name",
                        isolates_table.c.source_name,
                        "source_type",
                        isolates_table.c.source_type,
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(isolates_table.c.otu_id == otu_id)
        .order_by(isolates_table.c.virtool_id)
        .scalar_subquery()
    )


def _select_isolate_sequences(isolate_id: ColumnElement[int]) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "id",
                        sequences_table.c.id,
                        "accession",
                        sequences_table.c.accession,
                        "definition",
                        sequences_table.c.definition,
                        "host",
                        sequences_table.c.host,
                        "segment",
                        sequences_table.c.segment,
                        "sequence",
                        sequences_table.c.sequence,
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(sequences_table.c.isolate_id == isolate_id)
        .order_by(sequences_table.c.id)
        .scalar_subquery()
    )


def _json_bool(value: ColumnElement[int]) -> ColumnElement[bool]:
    return func.json(
        case(
            (value == 1, literal("true")),
            else_=literal("false"),
        )
    )
