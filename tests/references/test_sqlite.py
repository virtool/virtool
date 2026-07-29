"""Tests for SQLite reference artifacts."""

from pathlib import Path
from threading import get_ident

import pytest
from sqlalchemy import delete, insert, select, update

from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_FORMAT,
    REFERENCE_SQLITE_FORMAT_VERSION,
    SQLiteReference,
    isolates_table,
    metadata_table,
    otu_schema_table,
    otus_table,
    reference_table,
    sequences_table,
)

OTU_VERSION = 3


def test_reference_sqlite_file_name_is_versioned():
    assert REFERENCE_SQLITE_FILE_NAME == "reference-snapshot.v1.sqlite"


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


async def test_create_sqlite_reference_writes_schema_and_sequences(tmp_path: Path):
    """It writes normalized schema and sequence rows."""

    def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
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
        [_otu()],
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


def test_load_sqlite_reference_rejects_missing_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        SQLiteReference.load(tmp_path / REFERENCE_SQLITE_FILE_NAME)


async def test_iter_otus_rejects_otu_without_isolates(tmp_path: Path):
    otu = _otu()
    otu["isolates"] = []
    sqlite_reference = await SQLiteReference.create(
        tmp_path / REFERENCE_SQLITE_FILE_NAME,
        _reference(),
        [otu],
    )

    with pytest.raises(ValueError, match="has no isolates"):
        [otu async for otu in sqlite_reference.iter_otus()]


async def test_iter_otus_rejects_isolate_without_sequences(tmp_path: Path):
    otu = _otu()
    otu["isolates"][0]["sequences"] = []
    sqlite_reference = await SQLiteReference.create(
        tmp_path / REFERENCE_SQLITE_FILE_NAME,
        _reference(),
        [otu],
    )

    with pytest.raises(ValueError, match="has no sequences"):
        [otu async for otu in sqlite_reference.iter_otus()]


async def test_create_sqlite_reference_consumes_otus_off_event_loop_thread(
    tmp_path: Path,
):
    """It consumes and writes OTUs without blocking the event loop thread."""
    event_loop_thread_id = get_ident()
    iteration_thread_ids = []

    def iter_otus():
        iteration_thread_ids.append(get_ident())
        yield _otu()

    await SQLiteReference.create(
        tmp_path / REFERENCE_SQLITE_FILE_NAME,
        _reference(),
        iter_otus(),
    )

    assert len(iteration_thread_ids) == 1
    assert iteration_thread_ids[0] != event_loop_thread_id


async def test_create_sqlite_reference_without_reference(tmp_path: Path):
    """It writes OTUs without reference metadata."""

    def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, None, iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
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


async def test_connect_sqlite_reference_enables_foreign_keys(tmp_path: Path):
    """It enables foreign key enforcement on new connections."""

    def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


async def test_create_sqlite_reference_allows_sequence_segment_outside_otu_schema(
    tmp_path: Path,
):
    """It allows sequence segments that are not defined in the OTU schema."""

    def iter_otus():
        yield _otu(segments=("DNA A", "DNA B", "DNA C"))

    sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME

    await SQLiteReference.create(sqlite_path, _reference(), iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
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

    await SQLiteReference.create(sqlite_path, _reference(), iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
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

    await SQLiteReference.create(sqlite_path, _reference(), iter_otus())

    with SQLiteReference.load(sqlite_path).connect() as connection:
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
        iter_otus(),
    )

    with SQLiteReference.load(sqlite_path).connect() as connection:
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
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql("ALTER TABLE reference ADD COLUMN notes TEXT")
            connection.exec_driver_sql("CREATE TABLE producer_metadata (value TEXT)")

        await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_corrupt_database(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        sqlite_path.write_bytes(b"not a sqlite database")

        with pytest.raises(
            ValueError, match="Could not read SQLite reference database"
        ):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_required_table(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql("DROP TABLE otu_schema")

        with pytest.raises(ValueError, match="missing required tables: otu_schema"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_required_column(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
            connection.begin(),
        ):
            connection.exec_driver_sql(
                "ALTER TABLE sequences RENAME COLUMN host TO source_host"
            )

        with pytest.raises(ValueError, match=r"sequences.*columns: host"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_missing_format_metadata(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
            connection.begin(),
        ):
            connection.execute(
                delete(metadata_table).where(metadata_table.c.key == "format")
            )

        with pytest.raises(ValueError, match="metadata is missing 'format'"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_legacy_index_format(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
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
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
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
        await SQLiteReference.create(sqlite_path, None, [_otu()])

        with pytest.raises(ValueError, match=r"exactly one.*found 0"):
            await SQLiteReference.load(sqlite_path).validate()

    async def test_rejects_multiple_reference_metadata_rows(self, tmp_path: Path):
        sqlite_path = tmp_path / REFERENCE_SQLITE_FILE_NAME
        await SQLiteReference.create(sqlite_path, _reference(), [_otu()])
        second_reference = {**_reference(), "_id": "second_reference"}

        with (
            SQLiteReference.load(sqlite_path).connect() as connection,
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
