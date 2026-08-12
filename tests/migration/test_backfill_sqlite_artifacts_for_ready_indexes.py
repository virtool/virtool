"""Tests for the ready-index SQLite artifact backfill."""

import asyncio
import gzip
import uuid
from collections.abc import AsyncIterator, Callable
from datetime import datetime
from pathlib import Path

import orjson
import pytest
from pytest_structlog import StructuredLogCapture
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import assets.revisions.rev_5hnwczwh7skv_backfill_sqlite_artifacts_for_ready_indexes as revision
from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.migration.ctx import MigrationContext
from virtool.otus.db import write_legacy_otu, write_legacy_sequence
from virtool.otus.sql import SQLOTU
from virtool.references.sql import SQLReference
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
)
from virtool.users.pg import SQLUser

CREATED_AT = datetime(2020, 1, 2, 3, 4, 5)


@pytest.fixture(autouse=True)
async def _current_schema(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic)


def _make_otu(otu_id: str, name: str) -> dict:
    return {
        "_id": otu_id,
        "abbreviation": name[:3].upper(),
        "isolates": [
            {
                "default": True,
                "id": f"isolate-{otu_id}",
                "sequences": [
                    {
                        "_id": f"sequence-{otu_id}",
                        "accession": f"ACC-{otu_id}",
                        "definition": f"Sequence for {name}",
                        "host": "host",
                        "segment": None,
                        "sequence": "ACGT",
                    },
                ],
                "source_name": "source",
                "source_type": "isolate",
            },
        ],
        "name": name,
        "schema": [],
        "taxid": 1234,
        "version": 0,
    }


def _make_reference(reference_id: str = "embedded-reference") -> dict:
    return {
        "_id": reference_id,
        "created_at": "2019-12-01T01:02:03Z",
        "data_type": "genome",
        "name": "Embedded Reference",
        "organism": "Embedded organism",
    }


async def _write(ctx: MigrationContext, key: str, data: bytes) -> int:
    async def chunks() -> AsyncIterator[bytes]:
        yield data

    return await ctx.storage.write(key, chunks())


async def _write_gzip_json(ctx: MigrationContext, key: str, value: object) -> int:
    return await _write(ctx, key, gzip.compress(orjson.dumps(value)))


async def _seed_index(
    ctx: MigrationContext,
    label: str,
    *,
    ready: bool = True,
    manifest: dict[str, int] | None = None,
    otus_json_storage_key: str | None = None,
) -> tuple[int, int]:
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle=f"user-{label}",
            last_password_change=CREATED_AT,
            password=b"hashed",
            settings={},
        )
        session.add(user)
        await session.flush()

        reference = SQLReference(
            name=f"Postgres Reference {label}",
            description="Reference used by migration tests",
            organism=f"Postgres organism {label}",
            created_at=CREATED_AT,
            source_types=[],
            user_id=user.id,
        )
        session.add(reference)
        await session.flush()

        index = SQLIndex(
            version=0,
            created_at=CREATED_AT,
            manifest={} if manifest is None else manifest,
            ready=ready,
            storage_key=f"legacy-index-prefix-{label}",
            otus_json_storage_key=otus_json_storage_key,
            reference_id=reference.id,
            user_id=user.id,
        )
        session.add(index)
        await session.flush()
        index_id = index.id
        reference_id = reference.id
        await session.commit()

        return index_id, reference_id


async def _insert_index_file(
    ctx: MigrationContext,
    index_id: int,
    name: str,
    key: str,
    *,
    file_type: str,
    size: int | None,
) -> int:
    async with AsyncSession(ctx.pg) as session:
        row = SQLIndexFile(
            index=str(index_id),
            index_id=index_id,
            name=name,
            storage_key=key,
            type=file_type,
            size=size,
        )
        session.add(row)
        await session.flush()
        row_id = row.id
        await session.commit()
        return row_id


async def _add_reference_v2_source(
    ctx: MigrationContext,
    index_id: int,
    snapshot: dict,
) -> tuple[int, str, int]:
    key = f"indexes/{index_id}/legacy-reference-v2"
    size = await _write_gzip_json(ctx, key, snapshot)
    row_id = await _insert_index_file(
        ctx,
        index_id,
        REFERENCE_JSON_V2_FILE_NAME,
        key,
        file_type="json",
        size=size,
    )
    return row_id, key, size


async def _get_sqlite_row(ctx: MigrationContext, index_id: int) -> SQLIndexFile:
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                select(SQLIndexFile).where(
                    SQLIndexFile.index_id == index_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                ),
            )
        ).scalar_one()


async def _read_sqlite(
    ctx: MigrationContext,
    index_id: int,
    tmp_path: Path,
) -> SQLiteReference:
    row = await _get_sqlite_row(ctx, index_id)
    data = b"".join([chunk async for chunk in ctx.storage.read(row.storage_key)])
    path = tmp_path / f"result-{index_id}-{uuid.uuid4().hex}.sqlite"
    path.write_bytes(data)
    sqlite_reference = SQLiteReference.load(path)
    await sqlite_reference.validate()
    return sqlite_reference


async def _list_keys(ctx: MigrationContext, prefix: str) -> set[str]:
    return {item.key async for item in ctx.storage.list(prefix)}


async def _seed_history_otu(
    ctx: MigrationContext,
    reference_id: int,
    otu_id: str,
) -> dict:
    otu = _make_otu(otu_id, "History OTU")
    isolate = otu["isolates"][0]
    sequence = isolate["sequences"][0]
    otu_document = {
        **otu,
        "isolates": [
            {key: value for key, value in isolate.items() if key != "sequences"}
        ],
        "last_indexed_version": 0,
        "reference": {"id": reference_id},
        "verified": True,
    }
    sequence_document = {
        **sequence,
        "isolate_id": isolate["id"],
        "otu_id": otu_id,
        "reference": {"id": reference_id},
    }

    async with AsyncSession(ctx.pg) as session:
        await write_legacy_otu(session, otu_document)
        await write_legacy_sequence(session, sequence_document)
        await session.commit()

    return otu


class TestBackfillSources:
    async def test_creates_from_reference_v2_and_retains_embedded_header(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id, _ = await _seed_index(ctx, "reference-v2")
        reference = _make_reference()
        otu = _make_otu("otu-reference-v2", "Reference V2 OTU")
        await _add_reference_v2_source(ctx, index_id, {**reference, "otus": [otu]})

        await revision.upgrade(ctx)

        sqlite_reference = await _read_sqlite(ctx, index_id, tmp_path)
        assert await sqlite_reference.get_metadata() == {
            "id": reference["_id"],
            "created_at": reference["created_at"],
            "data_type": reference["data_type"],
            "name": reference["name"],
            "organism": reference["organism"],
        }
        assert [otu["id"] async for otu in sqlite_reference.iter_otus()] == [
            "otu-reference-v2"
        ]

    async def test_creates_from_otus_json_with_postgres_reference_metadata(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        key = "indexes/otus-json-source"
        index_id, reference_id = await _seed_index(
            ctx,
            "otus-json",
            otus_json_storage_key=key,
        )
        otu = _make_otu("otu-otus-json", "OTU JSON OTU")
        await _write_gzip_json(ctx, key, [otu])

        await revision.upgrade(ctx)

        sqlite_reference = await _read_sqlite(ctx, index_id, tmp_path)
        assert await sqlite_reference.get_metadata() == {
            "id": str(reference_id),
            "created_at": "2020-01-02T03:04:05Z",
            "data_type": "genome",
            "name": "Postgres Reference otus-json",
            "organism": "Postgres organism otus-json",
        }

    async def test_creates_from_manifest_history(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id, reference_id = await _seed_index(
            ctx,
            "history",
            manifest={"otu-history": 0},
        )
        await _seed_history_otu(ctx, reference_id, "otu-history")

        await revision.upgrade(ctx)

        sqlite_reference = await _read_sqlite(ctx, index_id, tmp_path)
        assert [otu["id"] async for otu in sqlite_reference.iter_otus()] == [
            "otu-history"
        ]

    async def test_corrupt_first_source_falls_through_to_otus_json(
        self,
        ctx: MigrationContext,
        log: StructuredLogCapture,
        tmp_path: Path,
    ) -> None:
        otus_key = "indexes/fallback/otus-json"
        index_id, _ = await _seed_index(
            ctx,
            "fallback",
            otus_json_storage_key=otus_key,
        )
        corrupt_key = "indexes/fallback/reference-v2"
        corrupt_size = await _write(ctx, corrupt_key, b"not gzip")
        await _insert_index_file(
            ctx,
            index_id,
            REFERENCE_JSON_V2_FILE_NAME,
            corrupt_key,
            file_type="json",
            size=corrupt_size,
        )
        await _write_gzip_json(
            ctx,
            otus_key,
            [_make_otu("otu-fallback", "Fallback OTU")],
        )

        await revision.upgrade(ctx)

        sqlite_reference = await _read_sqlite(ctx, index_id, tmp_path)
        assert [otu["id"] async for otu in sqlite_reference.iter_otus()] == [
            "otu-fallback"
        ]
        assert log.has(
            "SQLite artifact backfill source failed",
            index_id=index_id,
            source="reference-v2.json.gz",
        )
        assert log.has(
            "SQLite artifact backfill completed",
            index_id=index_id,
            outcome="rebuilt",
            source="otus.json.gz",
        )

    async def test_source_exhaustion_fails_after_other_indexes_complete(
        self,
        ctx: MigrationContext,
        log: StructuredLogCapture,
        tmp_path: Path,
    ) -> None:
        successful_id, _ = await _seed_index(ctx, "successful")
        await _add_reference_v2_source(
            ctx,
            successful_id,
            {
                **_make_reference("successful-reference"),
                "otus": [_make_otu("otu-successful", "Successful OTU")],
            },
        )

        failed_otus_key = "indexes/failed/otus-json"
        failed_id, _ = await _seed_index(
            ctx,
            "failed",
            manifest={"missing-otu": 0},
            otus_json_storage_key=failed_otus_key,
        )
        failed_v2_key = "indexes/failed/reference-v2"
        failed_v2_size = await _write(ctx, failed_v2_key, b"not gzip")
        await _insert_index_file(
            ctx,
            failed_id,
            REFERENCE_JSON_V2_FILE_NAME,
            failed_v2_key,
            file_type="json",
            size=failed_v2_size,
        )
        await _write_gzip_json(ctx, failed_otus_key, {"not": "a list"})

        with pytest.raises(RuntimeError, match=str(failed_id)):
            await revision.upgrade(ctx)

        await _read_sqlite(ctx, successful_id, tmp_path)

        async with AsyncSession(ctx.pg) as session:
            failed_count = await session.scalar(
                select(func.count())
                .select_from(SQLIndexFile)
                .where(
                    SQLIndexFile.index_id == failed_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                ),
            )

        assert failed_count == 0
        assert (
            log.count(
                "SQLite artifact backfill source failed",
                index_id=failed_id,
            )
            == 3
        )
        assert log.has(
            "SQLite artifact backfill failed",
            index_id=failed_id,
            outcome="failed",
        )


class TestExistingArtifacts:
    async def test_existing_artifact_row_is_skipped_without_storage_access(
        self,
        ctx: MigrationContext,
        log: StructuredLogCapture,
    ) -> None:
        index_id, _ = await _seed_index(ctx, "existing")
        key = f"indexes/{index_id}/existing-sqlite"
        row_id = await _insert_index_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_FILE_NAME,
            key,
            file_type="sqlite",
            size=123,
        )

        await revision.upgrade(ctx)

        row = await _get_sqlite_row(ctx, index_id)
        assert row.id == row_id
        assert row.storage_key == key
        assert await _list_keys(ctx, f"indexes/{index_id}/") == set()
        assert log.has(
            "SQLite artifact backfill completed",
            index_id=index_id,
            outcome="skipped",
        )

    async def test_publish_conflict_preserves_existing_row_and_cleans_candidate(
        self,
        ctx: MigrationContext,
        tmp_path: Path,
    ) -> None:
        index_id, _ = await _seed_index(ctx, "publish-conflict")
        existing_key = f"indexes/{index_id}/existing-sqlite"
        row_id = await _insert_index_file(
            ctx,
            index_id,
            REFERENCE_SQLITE_FILE_NAME,
            existing_key,
            file_type="sqlite",
            size=123,
        )
        candidate_path = tmp_path / "candidate.sqlite"
        candidate_path.write_bytes(b"candidate")

        with pytest.raises(IntegrityError):
            await revision._publish_candidate(ctx, index_id, candidate_path)

        row = await _get_sqlite_row(ctx, index_id)
        assert row.id == row_id
        assert row.storage_key == existing_key
        assert await _list_keys(ctx, f"indexes/{index_id}/") == set()


class TestRetryAndIsolation:
    async def test_database_failure_after_upload_cleans_object_and_retry_succeeds(
        self,
        ctx: MigrationContext,
        mocker,
        tmp_path: Path,
    ) -> None:
        index_id, _ = await _seed_index(ctx, "retry")
        _, source_key, _ = await _add_reference_v2_source(
            ctx,
            index_id,
            {
                **_make_reference(),
                "otus": [_make_otu("otu-retry", "Retry OTU")],
            },
        )
        patched = mocker.patch.object(
            AsyncSession,
            "commit",
            side_effect=RuntimeError("database interrupted"),
        )

        with pytest.raises(RuntimeError, match=str(index_id)):
            await revision.upgrade(ctx)

        assert await _list_keys(ctx, f"indexes/{index_id}/") == {source_key}
        async with AsyncSession(ctx.pg) as session:
            row = await session.scalar(
                select(SQLIndexFile).where(
                    SQLIndexFile.index_id == index_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                ),
            )
        assert row is None

        mocker.stop(patched)
        await revision.upgrade(ctx)

        row = await _get_sqlite_row(ctx, index_id)
        assert await _list_keys(ctx, f"indexes/{index_id}/") == {
            source_key,
            row.storage_key,
        }
        await _read_sqlite(ctx, index_id, tmp_path)

    async def test_only_initially_ready_indexes_are_processed_and_state_is_preserved(
        self,
        ctx: MigrationContext,
        mocker,
    ) -> None:
        legacy_otus_key = "indexes/protected/otus-json"
        ready_id, reference_id = await _seed_index(
            ctx,
            "protected",
            manifest={"otu-protected": 0},
            otus_json_storage_key=legacy_otus_key,
        )
        await _seed_history_otu(ctx, reference_id, "otu-protected")
        _, reference_v2_key, reference_v2_size = await _add_reference_v2_source(
            ctx,
            ready_id,
            {
                **_make_reference(),
                "otus": [_make_otu("otu-protected", "Protected OTU")],
            },
        )
        await _write_gzip_json(
            ctx,
            legacy_otus_key,
            [_make_otu("otu-protected", "Protected OTU")],
        )

        pending_id, _ = await _seed_index(ctx, "became-ready", ready=False)
        await _add_reference_v2_source(
            ctx,
            pending_id,
            {
                **_make_reference("pending-reference"),
                "otus": [_make_otu("otu-pending", "Pending OTU")],
            },
        )

        async with AsyncSession(ctx.pg) as session:
            before = (
                await session.execute(
                    select(
                        SQLIndex.ready,
                        SQLIndex.manifest,
                        SQLIndex.storage_key,
                        SQLIndex.otus_json_storage_key,
                        SQLIndex.reference_id,
                        SQLIndex.user_id,
                        SQLIndex.job_id,
                        SQLIndex.task_id,
                    ).where(SQLIndex.id == ready_id),
                )
            ).one()
            source_before = (
                await session.execute(
                    select(
                        SQLIndexFile.id,
                        SQLIndexFile.type,
                        SQLIndexFile.size,
                        SQLIndexFile.storage_key,
                    ).where(
                        SQLIndexFile.index_id == ready_id,
                        SQLIndexFile.name == REFERENCE_JSON_V2_FILE_NAME,
                    ),
                )
            ).one()
            otu_version_before = await session.scalar(
                select(SQLOTU.last_indexed_version).where(SQLOTU.id == "otu-protected"),
            )

        original_backfill = revision._backfill_index

        async def mark_pending_ready(ctx_: MigrationContext, index_id: int) -> None:
            async with AsyncSession(ctx_.pg) as session:
                await session.execute(
                    update(SQLIndex)
                    .where(SQLIndex.id == pending_id)
                    .values(ready=True),
                )
                await session.commit()
            await original_backfill(ctx_, index_id)

        mocker.patch.object(revision, "_backfill_index", side_effect=mark_pending_ready)

        await revision.upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            after = (
                await session.execute(
                    select(
                        SQLIndex.ready,
                        SQLIndex.manifest,
                        SQLIndex.storage_key,
                        SQLIndex.otus_json_storage_key,
                        SQLIndex.reference_id,
                        SQLIndex.user_id,
                        SQLIndex.job_id,
                        SQLIndex.task_id,
                    ).where(SQLIndex.id == ready_id),
                )
            ).one()
            source_after = (
                await session.execute(
                    select(
                        SQLIndexFile.id,
                        SQLIndexFile.type,
                        SQLIndexFile.size,
                        SQLIndexFile.storage_key,
                    ).where(
                        SQLIndexFile.index_id == ready_id,
                        SQLIndexFile.name == REFERENCE_JSON_V2_FILE_NAME,
                    ),
                )
            ).one()
            otu_version_after = await session.scalar(
                select(SQLOTU.last_indexed_version).where(SQLOTU.id == "otu-protected"),
            )
            pending_sqlite_count = await session.scalar(
                select(func.count())
                .select_from(SQLIndexFile)
                .where(
                    SQLIndexFile.index_id == pending_id,
                    SQLIndexFile.name == REFERENCE_SQLITE_FILE_NAME,
                ),
            )

        assert after == before
        assert source_after == source_before
        assert source_after.size == reference_v2_size
        assert source_after.storage_key == reference_v2_key
        assert otu_version_after == otu_version_before == 0
        assert pending_sqlite_count == 0
        assert await ctx.storage.size(reference_v2_key) == reference_v2_size
        assert await ctx.storage.size(legacy_otus_key) > 0
