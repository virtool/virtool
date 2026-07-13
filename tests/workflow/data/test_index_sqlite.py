"""Tests for index SQLite artifact creation and connections."""

from pathlib import Path

from sqlalchemy import select

from virtool.workflow.data.index_sqlite import (
    INDEX_SQLITE_FILE_NAME,
    connect_index_sqlite,
    create_index_sqlite,
    isolates_table,
    otu_schema_table,
    otus_table,
    reference_table,
    sequences_table,
)

OTU_VERSION = 3


def test_index_sqlite_file_name_is_versioned():
    assert INDEX_SQLITE_FILE_NAME == "virtool-index-sqlite-v1.sqlite"


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


async def test_create_index_sqlite_writes_schema_and_sequences(tmp_path: Path):
    """It writes normalized schema and sequence rows."""

    async def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, _reference(), iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
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


async def test_create_index_sqlite_without_reference(tmp_path: Path):
    """It writes OTUs without reference metadata."""

    async def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, None, iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
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


async def test_connect_index_sqlite_enables_foreign_keys(tmp_path: Path):
    """It enables foreign key enforcement on new connections."""

    async def iter_otus():
        yield _otu()

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, _reference(), iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


async def test_create_index_sqlite_allows_sequence_segment_outside_otu_schema(
    tmp_path: Path,
):
    """It allows sequence segments that are not defined in the OTU schema."""

    async def iter_otus():
        yield _otu(segments=("DNA A", "DNA B", "DNA C"))

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, _reference(), iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
        sequence_segments = (
            connection.execute(
                select(sequences_table.c.segment).order_by(sequences_table.c.segment),
            )
            .scalars()
            .all()
        )

    assert sequence_segments == ["DNA A", "DNA B", "DNA C"]


async def test_create_index_sqlite_allows_missing_required_isolate_segment(
    tmp_path: Path,
):
    """It allows isolates missing sequences for required schema entries."""

    async def iter_otus():
        yield _otu(segments=("DNA A",))

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, _reference(), iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
        sequence_segments = connection.execute(select(sequences_table.c.segment)).all()

    assert [row.segment for row in sequence_segments] == ["DNA A"]


async def test_create_index_sqlite_allows_null_segment_for_schema_otu(
    tmp_path: Path,
):
    """It allows null sequence segments for schema OTUs."""

    async def iter_otus():
        otu = _otu(segments=("DNA A",))
        otu["isolates"][0]["sequences"][0]["segment"] = None
        yield otu

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(sqlite_path, _reference(), iter_otus())

    with connect_index_sqlite(sqlite_path) as connection:
        segment = connection.execute(select(sequences_table.c.segment)).scalar_one()

    assert segment is None


async def test_create_index_sqlite_allows_legacy_otu_without_schema_or_abbreviation(
    tmp_path: Path,
):
    """It allows legacy OTUs that predate schema and abbreviation fields."""

    async def iter_otus():
        otu = _otu()
        del otu["abbreviation"]
        del otu["schema"]
        yield otu

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

    await create_index_sqlite(
        sqlite_path,
        _reference(),
        iter_otus(),
    )

    with connect_index_sqlite(sqlite_path) as connection:
        otu_row = connection.execute(select(otus_table)).mappings().one()
        schema_rows = connection.execute(select(otu_schema_table)).all()

    assert otu_row["abbreviation"] == ""
    assert schema_rows == []
