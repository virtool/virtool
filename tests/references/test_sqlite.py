"""Tests for SQLite reference artifacts."""

import gzip
from collections.abc import AsyncIterator, Iterable, Iterator
from contextlib import contextmanager
from pathlib import Path
from threading import get_ident

import pytest
from sqlalchemy import create_engine, delete, insert, select, update
from sqlalchemy.engine import URL, Connection

from virtool.references import sqlite as sqlite_module
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_FORMAT,
    REFERENCE_SQLITE_FORMAT_VERSION,
    REFERENCE_SQLITE_GZIP_FILE_NAME,
    SQLiteReference,
    SQLiteReferenceDecompressionError,
    SQLiteReferenceReadError,
    decompress_sqlite_reference,
    isolates_table,
    metadata_table,
    otu_schema_table,
    otus_table,
    reference_table,
    sequences_table,
)

OTU_VERSION = 3


@contextmanager
def _connect_sqlite(path: Path) -> Iterator[Connection]:
    engine = create_engine(URL.create("sqlite", database=str(path)))

    try:
        with engine.connect() as connection:
            yield connection
    finally:
        engine.dispose()


def test_reference_sqlite_file_name_is_versioned():
    assert REFERENCE_SQLITE_FILE_NAME == "reference-snapshot.v1.sqlite"
    assert REFERENCE_SQLITE_GZIP_FILE_NAME == "reference-snapshot.v1.sqlite.gz"


def _reference() -> dict:
    return {
        "_id": "reference",
        "created_at": "2026-01-15T19:55:34.203324Z",
        "data_type": "genome",
        "name": "0.1.1",
        "organism": "",
    }


def _sequence(segment: str) -> dict:
    return {
        "_id": f"sequence_{segment.replace(' ', '_').lower()}",
        "accession": "NC_010317",
        "definition": f"Abaca bunchy top virus {segment}",
        "host": "Musa sp.",
        "segment": segment,
        "sequence": "ACGT",
    }


def _otu(
    segments: tuple[str, ...] = ("DNA A", "DNA B"),
    *,
    required_b: bool = True,
) -> dict:
    return {
        "_id": "otu",
        "abbreviation": "ABTV",
        "isolates": [
            {
                "default": True,
                "id": "isolate",
                "sequences": [_sequence(segment) for segment in segments],
                "source_name": "Q767",
                "source_type": "isolate",
            },
        ],
        "name": "Abaca bunchy top virus",
        "schema": [
            {
                "molecule": "dsDNA",
                "name": "DNA A",
                "required": True,
            },
            {
                "molecule": "dsDNA",
                "name": "DNA B",
                "required": required_b,
            },
        ],
        "taxid": 1,
        "version": OTU_VERSION,
    }


def _other_otu(*, default: bool = False) -> dict:
    otu = _otu()
    otu["_id"] = "other_otu"
    otu["abbreviation"] = "OTH"
    otu["name"] = "Other virus"
    otu["isolates"][0]["id"] = "other_isolate"
    otu["isolates"][0]["default"] = default

    for sequence in otu["isolates"][0]["sequences"]:
        sequence["_id"] = f"other_{sequence['_id']}"

    return otu


async def _aiter(otus: Iterable[dict]) -> AsyncIterator[dict]:
    for otu in otus:
        yield otu


async def test_create_sqlite_reference_writes_schema_and_sequences(tmp_path: Path):
    """It writes normalized schema and sequence rows."""

    def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), _aiter(iter_otus()))

    with _connect_sqlite(sqlite_path) as connection:
        metadata = dict(connection.execute(select(metadata_table)).all())
        otu_row = connection.execute(select(otus_table)).mappings().one()
        isolate_row = connection.execute(select(isolates_table)).mappings().one()
        schema_rows = connection.execute(select(otu_schema_table)).all()
        sequence_rows = (
            connection.execute(
                select(sequences_table).order_by(sequences_table.c.segment),
            )
            .mappings()
            .all()
        )

    assert metadata == {
        "format": REFERENCE_SQLITE_FORMAT,
        "format_version": REFERENCE_SQLITE_FORMAT_VERSION,
        "created_by": "virtool",
    }
    assert REFERENCE_SQLITE_FORMAT == "virtool-reference-sqlite"
    assert REFERENCE_SQLITE_FORMAT_VERSION == "1"
    assert otu_row["version"] == OTU_VERSION
    assert isinstance(isolate_row["id"], int)
    assert isolate_row["virtool_id"] == "isolate"
    assert [(row.name, row.molecule, row.required) for row in schema_rows] == [
        ("DNA A", "dsDNA", 1),
        ("DNA B", "dsDNA", 1),
    ]
    assert "otu_id" not in sequence_rows[0]
    assert {row["isolate_id"] for row in sequence_rows} == {isolate_row["id"]}
    assert [row["segment"] for row in sequence_rows] == ["DNA A", "DNA B"]


async def test_sqlite_reference_round_trip(tmp_path: Path):
    sqlite_reference = await SQLiteReference.create(
        tmp_path / REFERENCE_SQLITE_FILE_NAME,
        _reference(),
        _aiter([_otu()]),
    )

    assert sqlite_reference.path.name == REFERENCE_SQLITE_FILE_NAME
    assert await sqlite_reference.get_metadata() == {
        "id": "reference",
        "created_at": "2026-01-15T19:55:34.203324Z",
        "data_type": "genome",
        "name": "0.1.1",
        "organism": "",
    }

    otus = [otu async for otu in sqlite_reference.iter_otus()]

    assert len(otus) == 1
    assert otus[0]["id"] == "otu"
    assert otus[0]["isolates"][0]["id"] == "isolate"
    assert otus[0]["isolates"][0]["default"] is True
    assert [sequence["id"] for sequence in otus[0]["isolates"][0]["sequences"]] == [
        "sequence_dna_a",
        "sequence_dna_b",
    ]
    assert [item["required"] for item in otus[0]["schema"]] == [True, True]


class TestDecompressSQLiteReference:
    async def test_streams_in_worker_thread_and_validates(
        self,
        mocker,
        tmp_path: Path,
    ):
        event_loop_thread_id = get_ident()
        decompression_thread_ids = []
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        compressed_path = tmp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
        await SQLiteReference.create(
            sqlite_path,
            _reference(),
            _aiter([_otu()]),
        )
        compressed_path.write_bytes(gzip.compress(sqlite_path.read_bytes()))
        sqlite_path.unlink()

        original_decompress = sqlite_module._decompress_sqlite_reference

        def decompress_in_thread(source_path: Path, target_path: Path) -> None:
            decompression_thread_ids.append(get_ident())
            original_decompress(source_path, target_path)

        decompress_file = mocker.patch.object(
            sqlite_module,
            "decompress_file_with_gzip",
            wraps=sqlite_module.decompress_file_with_gzip,
        )
        mocker.patch.object(
            sqlite_module,
            "_decompress_sqlite_reference",
            side_effect=decompress_in_thread,
        )

        await decompress_sqlite_reference(
            compressed_path,
            sqlite_path,
        )
        sqlite_reference = SQLiteReference.load(sqlite_path)
        await sqlite_reference.validate()

        assert sqlite_reference.path == sqlite_path
        assert await sqlite_reference.get_metadata() == {
            "id": "reference",
            "created_at": "2026-01-15T19:55:34.203324Z",
            "data_type": "genome",
            "name": "0.1.1",
            "organism": "",
        }
        assert len(decompression_thread_ids) == 1
        assert decompression_thread_ids[0] != event_loop_thread_id
        decompress_file.assert_called_once_with(compressed_path, sqlite_path)

    async def test_rejects_invalid_gzip(self, tmp_path: Path):
        compressed_path = tmp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        compressed_path.write_bytes(b"not gzip")

        with pytest.raises(
            SQLiteReferenceDecompressionError,
            match="Could not decompress SQLite reference gzip",
        ):
            await decompress_sqlite_reference(compressed_path, sqlite_path)

    async def test_rejects_truncated_gzip(self, tmp_path: Path):
        compressed_path = tmp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        compressed_path.write_bytes(gzip.compress(b"SQLite data")[:-4])

        with pytest.raises(
            SQLiteReferenceDecompressionError,
            match="Could not decompress SQLite reference gzip",
        ):
            await decompress_sqlite_reference(compressed_path, sqlite_path)

    async def test_distinguishes_invalid_sqlite_from_invalid_gzip(
        self,
        tmp_path: Path,
    ):
        compressed_path = tmp_path / REFERENCE_SQLITE_GZIP_FILE_NAME
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        compressed_path.write_bytes(gzip.compress(b"not a sqlite database"))

        await decompress_sqlite_reference(compressed_path, sqlite_path)

        with pytest.raises(SQLiteReferenceReadError):
            await SQLiteReference.load(sqlite_path).validate()

        assert sqlite_path.read_bytes() == b"not a sqlite database"


class TestSQLiteReferenceSequences:
    async def test_iter_sequences_reads_multiple_batches(self, mocker, tmp_path: Path):
        mocker.patch("virtool.references.sqlite._SQLITE_SEQUENCE_BATCH_SIZE", 1)
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu()]),
        )

        sequences = [sequence async for sequence in sqlite_reference.iter_sequences()]

        assert [sequence["id"] for sequence in sequences] == [
            "sequence_dna_a",
            "sequence_dna_b",
        ]

    async def test_iter_sequences_orders_and_shapes_sequences(self, tmp_path: Path):
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_other_otu(), _otu()]),
        )

        sequences = [sequence async for sequence in sqlite_reference.iter_sequences()]

        assert [sequence["id"] for sequence in sequences] == [
            "other_sequence_dna_a",
            "other_sequence_dna_b",
            "sequence_dna_a",
            "sequence_dna_b",
        ]
        assert sequences[0] == {
            "id": "other_sequence_dna_a",
            "accession": "NC_010317",
            "definition": "Abaca bunchy top virus DNA A",
            "host": "Musa sp.",
            "isolate_id": "other_isolate",
            "otu_id": "other_otu",
            "segment": "DNA A",
            "sequence": "ACGT",
        }

    async def test_iter_default_sequences_filters_non_default_isolates(
        self,
        tmp_path: Path,
    ):
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu(), _other_otu()]),
        )

        sequences = [
            sequence async for sequence in sqlite_reference.iter_default_sequences()
        ]

        assert [sequence["id"] for sequence in sequences] == [
            "sequence_dna_a",
            "sequence_dna_b",
        ]

    async def test_iter_otu_sequences_filters_by_one_or_more_otu_ids(
        self,
        tmp_path: Path,
    ):
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu(), _other_otu()]),
        )

        one_otu = [
            sequence
            async for sequence in sqlite_reference.iter_otu_sequences("other_otu")
        ]
        both_otus = [
            sequence
            async for sequence in sqlite_reference.iter_otu_sequences(
                ["otu", "other_otu"]
            )
        ]
        no_otus = [
            sequence async for sequence in sqlite_reference.iter_otu_sequences([])
        ]

        assert {sequence["otu_id"] for sequence in one_otu} == {"other_otu"}
        assert {sequence["otu_id"] for sequence in both_otus} == {
            "otu",
            "other_otu",
        }
        assert no_otus == []

    async def test_get_otu_summaries_by_sequence_ids(self, tmp_path: Path):
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu(), _other_otu()]),
        )

        otu_summaries = await sqlite_reference.get_otu_summaries_by_sequence_ids(
            ["sequence_dna_a", "other_sequence_dna_b"],
        )

        assert otu_summaries == {
            "sequence_dna_a": {
                "id": "otu",
                "abbreviation": "ABTV",
                "name": "Abaca bunchy top virus",
                "taxid": 1,
                "version": OTU_VERSION,
            },
            "other_sequence_dna_b": {
                "id": "other_otu",
                "abbreviation": "OTH",
                "name": "Other virus",
                "taxid": 1,
                "version": OTU_VERSION,
            },
        }

    async def test_get_otu_summaries_by_sequence_ids_rejects_missing_sequence(
        self,
        tmp_path: Path,
    ):
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu()]),
        )

        with pytest.raises(ValueError, match="does not exist in the reference"):
            await sqlite_reference.get_otu_summaries_by_sequence_ids(
                ["missing_sequence"]
            )

    async def test_allows_isolate_ids_reused_across_otus(self, tmp_path: Path):
        other_otu = _other_otu()
        other_otu["isolates"][0]["id"] = "isolate"
        sqlite_reference = await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([_otu(), other_otu]),
        )

        otus = {otu["id"]: otu async for otu in sqlite_reference.iter_otus()}
        otu_summaries = await sqlite_reference.get_otu_summaries_by_sequence_ids(
            ["sequence_dna_a", "other_sequence_dna_a"],
        )

        assert otus["otu"]["isolates"][0]["id"] == "isolate"
        assert otus["other_otu"]["isolates"][0]["id"] == "isolate"
        assert otu_summaries["sequence_dna_a"]["id"] == "otu"
        assert otu_summaries["other_sequence_dna_a"]["id"] == "other_otu"


def test_load_sqlite_reference_rejects_missing_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        SQLiteReference.load(tmp_path / REFERENCE_SQLITE_FILE_NAME)


async def test_create_rejects_otu_without_isolates(tmp_path: Path):
    otu = _otu()
    otu["isolates"] = []

    with pytest.raises(
        ValueError,
        match="OTU otu has no isolates in the SQLite reference",
    ):
        await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([otu]),
        )


async def test_create_rejects_isolate_without_sequences(tmp_path: Path):
    otu = _otu()
    otu["isolates"][0]["sequences"] = []

    with pytest.raises(
        ValueError,
        match=("Isolate isolate in OTU otu has no sequences in the SQLite reference"),
    ):
        await SQLiteReference.create(
            tmp_path / REFERENCE_SQLITE_FILE_NAME,
            _reference(),
            _aiter([otu]),
        )


async def test_iter_otus_does_not_validate_content(tmp_path: Path):
    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
    sqlite_reference = await SQLiteReference.create(
        sqlite_path,
        _reference(),
        _aiter([_otu()]),
    )

    with _connect_sqlite(sqlite_path) as connection, connection.begin():
        connection.execute(delete(sequences_table))

    first = [otu async for otu in sqlite_reference.iter_otus()]
    second = [otu async for otu in sqlite_reference.iter_otus()]

    assert first[0]["isolates"][0]["sequences"] == []
    assert second == first


async def test_create_sqlite_reference_without_reference(tmp_path: Path):
    """It writes OTUs without reference metadata."""

    def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, None, _aiter(iter_otus()))

    with _connect_sqlite(sqlite_path) as connection:
        reference_rows = connection.execute(select(reference_table)).all()
        otu_row = connection.execute(select(otus_table)).mappings().one()
        sequence_ids = (
            connection.execute(
                select(sequences_table.c.id).order_by(sequences_table.c.id),
            )
            .scalars()
            .all()
        )

    assert reference_rows == []
    assert otu_row["reference_id"] is None
    assert sequence_ids == ["sequence_dna_a", "sequence_dna_b"]


async def test_create_sqlite_reference_allows_sequence_segment_outside_otu_schema(
    tmp_path: Path,
):
    """It allows sequence segments that are not defined in the OTU schema."""

    def iter_otus():
        yield _otu(segments=("DNA A", "DNA B", "DNA C"))

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), _aiter(iter_otus()))

    with _connect_sqlite(sqlite_path) as connection:
        sequence_segments = (
            connection.execute(
                select(sequences_table.c.segment).order_by(sequences_table.c.segment),
            )
            .scalars()
            .all()
        )

    assert sequence_segments == ["DNA A", "DNA B", "DNA C"]


async def test_create_sqlite_reference_allows_missing_required_isolate_segment(
    tmp_path: Path,
):
    """It allows isolates missing sequences for required schema entries."""

    def iter_otus():
        yield _otu(segments=("DNA A",))

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), _aiter(iter_otus()))

    with _connect_sqlite(sqlite_path) as connection:
        sequence_segments = connection.execute(select(sequences_table.c.segment)).all()

    assert [row.segment for row in sequence_segments] == ["DNA A"]


async def test_create_sqlite_reference_allows_null_segment_for_schema_otu(
    tmp_path: Path,
):
    """It allows null sequence segments for schema OTUs."""

    def iter_otus():
        otu = _otu(segments=("DNA A",))
        otu["isolates"][0]["sequences"][0]["segment"] = None
        yield otu

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), _aiter(iter_otus()))

    with _connect_sqlite(sqlite_path) as connection:
        segment = connection.execute(select(sequences_table.c.segment)).scalar_one()

    assert segment is None


async def test_create_sqlite_reference_allows_legacy_otu_without_schema_or_abbreviation(
    tmp_path: Path,
):
    """It allows legacy OTUs that predate schema and abbreviation fields."""

    def iter_otus():
        otu = _otu()
        del otu["abbreviation"]
        del otu["schema"]
        yield otu

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(
        sqlite_path,
        _reference(),
        _aiter(iter_otus()),
    )

    with _connect_sqlite(sqlite_path) as connection:
        otu_row = connection.execute(select(otus_table)).mappings().one()
        schema_rows = connection.execute(select(otu_schema_table)).all()

    assert otu_row["abbreviation"] == ""
    assert schema_rows == []


class TestValidateSQLiteReference:
    async def test_accepts_compatible_v1_database_with_extra_table_and_column(
        self,
        tmp_path: Path,
    ):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql("ALTER TABLE reference ADD COLUMN notes TEXT")
            connection.exec_driver_sql("CREATE TABLE producer_metadata (value TEXT)")

        await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_corrupt_database(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        sqlite_path.write_bytes(b"not a sqlite database")

        with pytest.raises(SQLiteReferenceReadError) as exc_info:
            await SQLiteReference.load(sqlite_path).validate()

        assert str(exc_info.value) == "Could not read SQLite reference database"
        assert isinstance(exc_info.value, ValueError)
        assert exc_info.value.__cause__ is not None

    async def test_rejects_missing_required_table(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql("DROP TABLE otu_schema")

        with pytest.raises(ValueError, match="missing required tables: otu_schema"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_required_column(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql(
                "ALTER TABLE sequences RENAME COLUMN host TO source_host"
            )

        with pytest.raises(ValueError, match=r"sequences.*columns: host"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_format_metadata(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.execute(
                delete(metadata_table).where(metadata_table.c.key == "format")
            )

        with pytest.raises(ValueError, match="metadata is missing 'format'"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_legacy_index_format(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.execute(
                update(metadata_table)
                .where(metadata_table.c.key == "format")
                .values(value="virtool-index-sqlite")
            )

        with pytest.raises(ValueError, match="Unsupported SQLite reference format"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_unsupported_format_version(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.execute(
                update(metadata_table)
                .where(metadata_table.c.key == "format_version")
                .values(value="2")
            )

        with pytest.raises(ValueError, match="format version: '2'"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_reference_metadata(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, None, _aiter([_otu()]))

        with pytest.raises(ValueError, match=r"exactly one.*found 0"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_multiple_reference_metadata_rows(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), _aiter([_otu()]))
        second_reference = {**_reference(), "_id": "second_reference"}

        with (
            _connect_sqlite(sqlite_path) as connection,
            connection.begin(),
        ):
            connection.execute(
                insert(reference_table),
                {
                    "id": second_reference["_id"],
                    "created_at": second_reference["created_at"],
                    "data_type": second_reference["data_type"],
                    "name": second_reference["name"],
                    "organism": second_reference["organism"],
                },
            )

        with pytest.raises(ValueError, match=r"exactly one.*found 2"):
            await SQLiteReference.load(sqlite_path).validate()
