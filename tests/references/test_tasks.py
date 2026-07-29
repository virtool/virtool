import datetime
import gzip
import json
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.data.topg import compose_legacy_id_subquery
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.indexes.constants import INDEX_SQLITE_FILE_NAME
from virtool.otus.db import otu_document_from_row, sequence_document_from_row
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.db import get_manifest
from virtool.references.models import Reference
from virtool.references.sql import SQLReference
from virtool.references.tasks import (
    CloneReferenceTask,
    ImportReferenceTask,
)
from virtool.tasks.models import Task
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.workflow.data.index_sqlite import (
    connect_index_sqlite,
    create_index_sqlite,
    otus_table,
    reference_table,
    sequences_table,
)
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
def assert_reference_created(
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    async def func():
        async with AsyncSession(pg) as pg_session:
            otu_rows = (
                (
                    await pg_session.execute(
                        select(SQLOTU).order_by(SQLOTU.name),
                    )
                )
                .scalars()
                .all()
            )

            sequence_rows = (
                (
                    await pg_session.execute(
                        select(SQLSequence).order_by(
                            SQLSequence.data["accession"].astext,
                        ),
                    )
                )
                .scalars()
                .all()
            )

        otus = [otu_document_from_row(row) for row in otu_rows]
        sequences = [sequence_document_from_row(row) for row in sequence_rows]

        assert otus == snapshot(
            name="otus",
            matcher=path_type(
                {
                    ".*_id": (str,),
                    r".*\d\.id": (str,),
                    ".*created_at": (datetime.datetime,),
                },
                regex=True,
            ),
        )

        assert sequences == snapshot(
            name="sequences",
            matcher=path_type(
                {
                    ".*_id": (str,),
                },
                regex=True,
            ),
        )

        async with AsyncSession(pg) as pg_session:
            history_rows = (
                (
                    await pg_session.execute(
                        select(SQLLegacyHistory).order_by(SQLLegacyHistory.otu_name),
                    )
                )
                .scalars()
                .all()
            )

        assert len(history_rows) == len(otus)

        change_ids = [row.legacy_id for row in history_rows]

        async with AsyncSession(pg) as pg_session:
            diff_rows = (
                (
                    await pg_session.execute(
                        select(SQLLegacyHistoryDiff).where(
                            SQLLegacyHistoryDiff.change_id.in_(change_ids),
                        ),
                    )
                )
                .scalars()
                .all()
            )

        diff_by_change_id = {row.change_id: row.diff for row in diff_rows}

        assert [
            {"change_id": cid, "diff": diff_by_change_id[cid]} for cid in change_ids
        ] == snapshot(
            name="history_diffs",
            matcher=path_type(
                {
                    ".*change_id": (str,),
                    ".*_id": (str,),
                    r".*\d\.id": (str,),
                },
                regex=True,
            ),
        )

    return func


@pytest.fixture
def spawn_import_task(
    data_layer: DataLayer,
    example_path: Path,
    fake: DataFaker,
    pg: AsyncEngine,
):
    """Seed a reference and the ``ImportReferenceTask`` that populates it.

    The task is spawned directly, mirroring production where the TypeScript server
    creates the reference and queues the task.
    """

    async def func(
        name: str = "Test",
        upload_path: Path | None = None,
        upload_name: str = "import.json.gz",
    ) -> tuple[Reference, Task]:
        user = await fake.users.create()
        reference = await fake.references.create(user=user, name=name)
        upload_path = upload_path or example_path / "indexes/reference.json.gz"

        upload = await data_layer.uploads.create(
            fake_file_chunker(upload_path),
            upload_name,
            UploadType.reference,
            user.id,
        )

        async with AsyncSession(pg) as session:
            name_on_disk = await session.scalar(
                select(SQLUpload.name_on_disk).where(SQLUpload.id == upload.id),
            )

        task = await fake.tasks.create_with_class(
            ImportReferenceTask,
            {
                "name_on_disk": name_on_disk,
                "ref_id": reference.id,
                "user_id": user.id,
            },
        )

        return reference, task

    return func


@pytest.fixture
async def reference_sqlite_path(example_path: Path, tmp_path: Path) -> Path:
    with gzip.open(example_path / "indexes/reference.json.gz", "rt") as handle:
        data = json.load(handle)

    for otu in data["otus"]:
        otu["version"] = 0

    sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME
    await create_index_sqlite(
        sqlite_path,
        {
            "id": "source_reference",
            "created_at": data["created_at"],
            "data_type": data["data_type"],
            "name": "Source Reference",
            "organism": data["organism"],
        },
        data["otus"],
    )

    return sqlite_path


@pytest.fixture
def assert_reference_not_populated(pg: AsyncEngine):
    async def assert_not_populated() -> None:
        async with AsyncSession(pg) as session:
            otu_count = await session.scalar(select(func.count()).select_from(SQLOTU))
            sequence_count = await session.scalar(
                select(func.count()).select_from(SQLSequence)
            )
            history_count = await session.scalar(
                select(func.count()).select_from(SQLLegacyHistory)
            )

        assert otu_count == 0
        assert sequence_count == 0
        assert history_count == 0

    return assert_not_populated


@pytest.fixture
def assert_reference_populated(pg: AsyncEngine):
    async def assert_populated() -> None:
        async with AsyncSession(pg) as session:
            otu_count = await session.scalar(select(func.count()).select_from(SQLOTU))
            sequence_count = await session.scalar(
                select(func.count()).select_from(SQLSequence)
            )
            history_count = await session.scalar(
                select(func.count()).select_from(SQLLegacyHistory)
            )

        assert otu_count == 20
        assert sequence_count == 26
        assert history_count == 20

    return assert_populated


@pytest.fixture
async def imported_reference(
    data_layer: DataLayer,
    spawn_import_task,
) -> int:
    """The id of a reference populated by a completed ``ImportReferenceTask``."""
    reference, task = await spawn_import_task()

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    return reference.id


async def _reference_row(pg: AsyncEngine, reference_id: int) -> SQLReference | None:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLReference).where(SQLReference.id == reference_id),
            )
        ).scalar_one_or_none()


@pytest.mark.flaky(reruns=2)
async def test_import_reference_task(
    assert_reference_created,
    data_layer: DataLayer,
    spawn_import_task,
    static_time: StaticTime,
):
    _, task = await spawn_import_task()

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    await assert_reference_created()


@pytest.mark.flaky(reruns=2)
async def test_import_reference_task_from_canonical_sqlite(
    assert_reference_populated,
    data_layer: DataLayer,
    reference_sqlite_path: Path,
    spawn_import_task,
    static_time: StaticTime,
):
    _, task = await spawn_import_task(
        upload_path=reference_sqlite_path,
        upload_name=INDEX_SQLITE_FILE_NAME,
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.complete is True
    assert completed_task.error is None
    await assert_reference_populated()


@pytest.mark.flaky(reruns=2)
async def test_import_reference_task_from_producer_named_sqlite(
    assert_reference_populated,
    data_layer: DataLayer,
    reference_sqlite_path: Path,
    spawn_import_task,
    static_time: StaticTime,
):
    _, task = await spawn_import_task(
        upload_path=reference_sqlite_path,
        upload_name="external-reference.v1.sqlite",
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.complete is True
    assert completed_task.error is None
    await assert_reference_populated()


async def test_import_reference_task_streams_sqlite_to_scratch_space(
    data_layer: DataLayer,
    mocker,
    reference_sqlite_path: Path,
    spawn_import_task,
):
    _, task = await spawn_import_task(
        upload_path=reference_sqlite_path,
        upload_name="external-reference.v1.sqlite",
    )
    import_task = await ImportReferenceTask.from_task_id(data_layer, task.id)
    sqlite_data = reference_sqlite_path.read_bytes()
    chunks = [sqlite_data[:100], sqlite_data[100:1000], sqlite_data[1000:]]
    observed_sizes = []

    async def read_in_chunks(_key: str):
        for chunk in chunks:
            yield chunk
            observed_sizes.append(
                (import_task.temp_path / "reference.v1.sqlite").stat().st_size
            )

    mocker.patch.object(
        data_layer.references._storage,
        "read",
        new=read_in_chunks,
    )

    await import_task.run()

    assert observed_sizes == [100, 1000, len(sqlite_data)]


async def test_import_reference_task_rejects_unsupported_filename(
    assert_reference_not_populated,
    data_layer: DataLayer,
    example_path: Path,
    spawn_import_task,
):
    _, task = await spawn_import_task(
        upload_path=example_path / "indexes/reference.json.gz",
        upload_name="reference.sqlite",
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error == (
        "Unsupported reference file name; expected a .json.gz or .v1.sqlite suffix"
    )
    await assert_reference_not_populated()


async def test_import_reference_task_rejects_invalid_gzip(
    assert_reference_not_populated,
    data_layer: DataLayer,
    spawn_import_task,
    tmp_path: Path,
):
    invalid_gzip_path = tmp_path / "invalid.json.gz"
    invalid_gzip_path.write_bytes(b"not gzip")
    _, task = await spawn_import_task(upload_path=invalid_gzip_path)

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error == "Not a gzipped file"
    await assert_reference_not_populated()


async def test_import_reference_task_rejects_invalid_json(
    assert_reference_not_populated,
    data_layer: DataLayer,
    spawn_import_task,
    tmp_path: Path,
):
    invalid_json_path = tmp_path / "invalid.json.gz"
    with gzip.open(invalid_json_path, "wt") as handle:
        handle.write("{")

    _, task = await spawn_import_task(upload_path=invalid_json_path)

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error is not None
    assert "Expecting property name" in completed_task.error
    await assert_reference_not_populated()


async def test_import_reference_task_rejects_corrupt_sqlite(
    assert_reference_not_populated,
    data_layer: DataLayer,
    spawn_import_task,
    tmp_path: Path,
):
    corrupt_sqlite_path = tmp_path / "corrupt.v1.sqlite"
    corrupt_sqlite_path.write_bytes(b"not a sqlite database")
    _, task = await spawn_import_task(
        upload_path=corrupt_sqlite_path,
        upload_name="corrupt.v1.sqlite",
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error is not None
    assert "Invalid index SQLite file" in completed_task.error
    assert "Could not read index SQLite database" in completed_task.error
    await assert_reference_not_populated()


async def test_import_reference_task_rejects_missing_reference_metadata(
    assert_reference_not_populated,
    data_layer: DataLayer,
    reference_sqlite_path: Path,
    spawn_import_task,
):
    with connect_index_sqlite(reference_sqlite_path) as connection, connection.begin():
        connection.execute(otus_table.update().values(reference_id=None))
        connection.execute(reference_table.delete())

    _, task = await spawn_import_task(
        upload_path=reference_sqlite_path,
        upload_name="missing-reference.v1.sqlite",
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error is not None
    assert "exactly one reference metadata row; found 0" in completed_task.error
    await assert_reference_not_populated()


async def test_import_reference_task_rejects_invalid_source_data(
    assert_reference_not_populated,
    data_layer: DataLayer,
    reference_sqlite_path: Path,
    spawn_import_task,
):
    with connect_index_sqlite(reference_sqlite_path) as connection, connection.begin():
        connection.execute(sequences_table.update().values(sequence="ACGT"))

    _, task = await spawn_import_task(
        upload_path=reference_sqlite_path,
        upload_name="invalid-source.v1.sqlite",
    )

    await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

    completed_task = await data_layer.tasks.get(task.id)
    assert completed_task.error is not None
    assert completed_task.error.startswith("Invalid reference data:")
    assert "ensure this value has at least 10 characters" in completed_task.error
    await assert_reference_not_populated()


async def test_clone_reference_task(
    data_layer: DataLayer,
    fake: DataFaker,
    imported_reference: int,
    pg: AsyncEngine,
):
    manifest = await get_manifest(pg, imported_reference)

    assert len(manifest) == 20

    user = await fake.users.create()
    clone = await fake.references.create(user=user, name="Clone")

    clone_task = await fake.tasks.create_with_class(
        CloneReferenceTask,
        {"manifest": manifest, "ref_id": clone.id, "user_id": user.id},
    )

    async def count_history(reference: int | None = None) -> int:
        query = select(func.count()).select_from(SQLLegacyHistory)

        if reference is not None:
            query = query.where(
                SQLLegacyHistory.reference_id
                == compose_legacy_id_subquery(SQLReference, reference),
            )

        async with AsyncSession(pg) as session:
            return await session.scalar(query)

    async def count_otus() -> int:
        async with AsyncSession(pg) as session:
            return await session.scalar(select(func.count()).select_from(SQLOTU))

    assert await count_history() == 20
    assert await count_otus() == 20

    await (await CloneReferenceTask.from_task_id(data_layer, clone_task.id)).run()

    task = await data_layer.tasks.get(clone_task.id)

    assert task.complete is True
    assert task.progress == 100

    # Make sure OTU count is sum of source and destination references.
    assert await count_otus() == 40

    assert await count_history() == 40
    assert await count_history(clone.id) == 20


class TestImportReferencePopulation:
    """The import population task writes and rolls back the Postgres reference."""

    @pytest.mark.flaky(reruns=2)
    async def test_writes_organism(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        spawn_import_task,
    ):
        """The imported organism is written to Postgres."""
        reference, task = await spawn_import_task()

        await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

        row = await _reference_row(pg, reference.id)

        assert row is not None
        assert row.organism == "virus"

    async def test_rollback_deletes_postgres_row(
        self,
        data_layer: DataLayer,
        mocker,
        pg: AsyncEngine,
        spawn_import_task,
    ):
        """A failed insertion rolls back the Postgres reference row."""
        reference, task = await spawn_import_task()

        mocker.patch(
            "virtool.references.db.bulk_insert_otu_rows",
            side_effect=RuntimeError("boom"),
        )

        await (await ImportReferenceTask.from_task_id(data_layer, task.id)).run()

        assert await _reference_row(pg, reference.id) is None


class TestCloneReferencePopulation:
    """The clone population task writes and rolls back the Postgres reference."""

    async def test_rollback_deletes_postgres_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        imported_reference: int,
        mocker,
        pg: AsyncEngine,
    ):
        """A failed clone insertion rolls back the Postgres reference row."""
        user = await fake.users.create()
        clone = await fake.references.create(user=user, name="Clone")

        clone_task = await fake.tasks.create_with_class(
            CloneReferenceTask,
            {
                "manifest": await get_manifest(pg, imported_reference),
                "ref_id": clone.id,
                "user_id": user.id,
            },
        )

        mocker.patch(
            "virtool.references.db.bulk_insert_otu_rows",
            side_effect=RuntimeError("boom"),
        )

        await (await CloneReferenceTask.from_task_id(data_layer, clone_task.id)).run()

        assert await _reference_row(pg, clone.id) is None
