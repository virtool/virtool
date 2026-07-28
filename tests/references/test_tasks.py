import datetime
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

    async def func(name: str = "Test") -> tuple[Reference, Task]:
        user = await fake.users.create()
        reference = await fake.references.create(user=user, name=name)

        upload = await data_layer.uploads.create(
            fake_file_chunker(example_path / "indexes/reference.json.gz"),
            "import.json.gz",
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
