import asyncio
import datetime
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.references.db import get_manifest
from virtool.references.tasks import (
    CloneReferenceTask,
    ImportReferenceTask,
)
from virtool.storage.protocol import StorageBackend
from virtool.tasks.sql import SQLTask
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
def assert_reference_created(
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    async def func(
        query: dict | None = None,
    ):
        references, otus, sequences = await asyncio.gather(
            mongo.references.find_one("foo"),
            mongo.otus.find(query or {}, sort=[("name", 1)]).to_list(None),
            mongo.sequences.find(query or {}, sort=[("accession", 1)]).to_list(None),
        )

        assert references == snapshot(name="ref")

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


@pytest.mark.flaky(reruns=2)
async def test_import_reference_task(
    assert_reference_created,
    data_layer: DataLayer,
    example_path: Path,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
):
    user = await fake.users.create()

    upload = await data_layer.uploads.create(
        fake_file_chunker(example_path / "indexes/reference.json.gz"),
        "import.json.gz",
        UploadType.reference,
        user.id,
    )

    upload_row = await get_row_by_id(pg, SQLUpload, upload.id)

    await memory_storage.write(
        upload_file_key(upload_row.name_on_disk),
        fake_file_chunker(example_path / "indexes/reference.json.gz"),
    )

    await mongo.references.insert_one(
        {
            "_id": "foo",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "A test reference",
            "user": {
                "id": user.id,
            },
        },
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={
                    "name_on_disk": upload_row.name_on_disk,
                    "ref_id": "foo",
                    "user_id": user.id,
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            ),
        )

        await session.commit()

    task = await ImportReferenceTask.from_task_id(data_layer, 1)

    await task.run()
    await assert_reference_created()


@pytest.fixture
async def create_reference(
    example_path: Path,
    fake: DataFaker,
    data_layer: DataLayer,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
):
    user = await fake.users.create()

    upload = await data_layer.uploads.create(
        fake_file_chunker(example_path / "indexes/reference.json.gz"),
        "import.json.gz",
        UploadType.reference,
        user.id,
    )

    upload_row = await get_row_by_id(pg, SQLUpload, upload.id)

    await memory_storage.write(
        upload_file_key(upload_row.name_on_disk),
        fake_file_chunker(example_path / "indexes/reference.json.gz"),
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=2,
                complete=False,
                context={
                    "name_on_disk": upload_row.name_on_disk,
                    "ref_id": "bar",
                    "user_id": user.id,
                },
                count=0,
                created_at=static_time.datetime,
                progress=0,
                step="load_file",
                type="import_reference",
            ),
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "bar",
                    "archived": False,
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "name": "Test",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user.id},
                    "users": [],
                },
            ),
        )

    task = await ImportReferenceTask.from_task_id(data_layer, 2)
    await task.run()

    return "bar"


async def test_clone_reference_task(
    assert_reference_created,
    create_reference: str,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time: StaticTime,
):
    manifest = await get_manifest(mongo, create_reference)

    assert len(manifest) == 20

    user = await fake.users.create()

    await mongo.references.insert_one(
        {
            "_id": "foo",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "A test reference",
            "groups": [],
            "name": "Test",
            "organism": "virus",
            "restrict_source_types": False,
            "source_types": [],
            "user": {
                "id": user.id,
            },
            "users": [],
        },
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={
                    "manifest": manifest,
                    "ref_id": "foo",
                    "user_id": user.id,
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            ),
        )

        await session.commit()

    async def count_history(reference: str | None = None) -> int:
        query = select(func.count()).select_from(SQLLegacyHistory)

        if reference is not None:
            query = query.where(SQLLegacyHistory.reference == reference)

        async with AsyncSession(pg) as session:
            return await session.scalar(query)

    assert await count_history() == 20
    assert await mongo.otus.count_documents({}) == 20

    task_instance = await CloneReferenceTask.from_task_id(data_layer, 1)
    await task_instance.run()

    task = await data_layer.tasks.get(1)

    assert task.complete is True
    assert task.progress == 100

    otus = await mongo.otus.find({}).to_list(None)

    # Make sure OTU count is sum of source and destination references.
    assert len(otus) == 40

    assert await count_history() == 40
    assert await count_history("foo") == 20
