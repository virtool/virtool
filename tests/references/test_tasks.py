import asyncio
import datetime
import shutil
from pathlib import Path
from typing import Optional, Dict

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy.matchers import path_type

from virtool.pg.utils import get_row_by_id
from virtool.references.db import get_manifest
from virtool.references.tasks import (
    CleanReferencesTask,
    ImportReferenceTask,
    RemoteReferenceTask,
    CloneReferenceTask,
)
from virtool.tasks.models import Task
from virtool.uploads.models import UploadType
from virtool.utils import get_temp_dir

TEST_FILES_PATH = Path(__file__).parent.parent / "test_files"


@pytest.mark.parametrize(
    "update",
    [
        None,
        {"name": "v1.2.0"},
        {"name": "v1.2.2", "ready": True},
        {
            "name": "v1.2.2",
            "created_at": arrow.get("2020-01-01T21:20:00").datetime,
            "ready": False,
        },
        {
            "name": "v1.2.2",
            "created_at": arrow.get("2020-01-01T21:00:00").datetime,
            "ready": False,
        },
    ],
    ids=["no_updates", "too_old", "ready", "too_new", "clean"],
)
async def test_clean_references_task(
    update, data_layer, mocker, mongo, pg, snapshot, static_time
):
    """
    Test the following situations:

    * no updates have been applied to the references (`[]`)
    * the latest update is older than the installed version
    * the latest update is ready indicating the update was successful
    * the latest update subdocument was created recently and shouldn't be removed
    * the latest update subdocument is old and not ready (timed out)
    """
    mocker.patch("arrow.utcnow", return_value=arrow.get("2020-01-01T21:25:00"))

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="clean_timed_out_updates",
        type="clean_references",
        created_at=static_time.datetime,
    )

    updates = []

    if update:
        updates.append(update)

    async with AsyncSession(pg) as session:
        session.add(task)

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "foo",
                    "updates": updates,
                    "installed": {"name": "v1.2.1"},
                    "updating": True,
                    "remotes_from": {"slug": "virtool/ref-plant-viruses"},
                }
            ),
        )

    task = CleanReferencesTask(1, data_layer, {}, get_temp_dir())
    await task.run()

    assert await mongo.references.find_one({}) == snapshot


@pytest.fixture
def assert_reference_created(mongo, snapshot):
    async def func(
        query: Optional[Dict] = None,
    ):
        references, otus, sequences, history = await asyncio.gather(
            mongo.references.find_one("foo"),
            mongo.otus.find(query or {}, sort=[("name", 1)]).to_list(None),
            mongo.sequences.find(query or {}, sort=[("accession", 1)]).to_list(None),
            mongo.history.find(query or {}, sort=[("otu.name", 1)]).to_list(None),
        )

        assert references == snapshot(name="ref")

        assert otus == snapshot(
            name="otus",
            matcher=path_type(
                {".*_id": (str,), ".*created_at": (datetime.datetime,)},
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

        assert history == snapshot(
            name="history",
            matcher=path_type({".*_id": (str,), ".*otu.id": (str,)}, regex=True),
        )

    return func


@pytest.mark.flaky(reruns=2)
async def test_import_reference_task(
    assert_reference_created,
    data_layer,
    mongo,
    pg,
    snapshot,
    static_time,
    tmpdir,
    fake2,
):
    path = Path(tmpdir.mkdir("files")) / "reference.json.gz"
    shutil.copyfile(TEST_FILES_PATH / "reference.json.gz", path)

    user = await fake2.users.create()

    await data_layer.uploads.create(
        "import.json.gz", UploadType.reference, False, user.id
    )

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={
                    "path": str(path),
                    "ref_id": "foo",
                    "user_id": "test",
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            )
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                }
            ),
        )

    task = await ImportReferenceTask.from_task_id(data_layer, 1)

    await task.run()
    await assert_reference_created()


async def test_remote_reference_task(
    assert_reference_created,
    caplog,
    data_layer,
    mocker,
    mongo,
    pg,
    snapshot,
    static_time,
    tmpdir,
):
    async def download_file(url, target_path, _):
        shutil.copyfile(TEST_FILES_PATH / "reference.json.gz", target_path)

    mocker.patch("virtool.references.tasks.download_file", download_file)

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={
                    "ref_id": "foo",
                    "user_id": "test",
                    "release": {
                        "download_url": "https://virtool.example.com/downloads/reference.json.gz",
                        "id": 12345,
                        "size": 1,
                    },
                },
                count=0,
                progress=0,
                step="download",
                type="remote_reference",
                created_at=static_time.datetime,
            )
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "updates": [{"id": 12345, "ready": False}],
                }
            ),
        )

    task = await RemoteReferenceTask.from_task_id(data_layer, 1)

    await task.run()
    await assert_reference_created()


@pytest.fixture()
async def create_reference(pg, tmpdir, fake2, data_layer, static_time, mongo):
    path = Path(tmpdir.mkdir("files")) / "reference.json.gz"
    shutil.copyfile(TEST_FILES_PATH / "reference.json.gz", path)

    user = await fake2.users.create()

    await data_layer.uploads.create(
        "import.json.gz", UploadType.reference, False, user.id
    )

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=2,
                complete=False,
                context={
                    "path": str(path),
                    "ref_id": "bar",
                    "user_id": "test",
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            )
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "bar",
                    "created_at": static_time.datetime,
                }
            ),
        )

    task = await ImportReferenceTask.from_task_id(data_layer, 2)
    await task.run()

    return "bar"


async def test_clone_reference(
    assert_reference_created,
    caplog,
    data_layer,
    mongo,
    pg,
    snapshot,
    static_time,
    tmpdir,
    fake2,
    create_reference,
):
    manifest = await get_manifest(mongo, create_reference)

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={
                    "manifest": manifest,
                    "ref_id": "foo",
                    "user_id": "test",
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            )
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                }
            ),
        )

    task = await CloneReferenceTask.from_task_id(data_layer, 1)
    await task.run()

    row = await get_row_by_id(pg, Task, 1)
    assert row.complete is True

    await assert_reference_created(query={"reference.id": "foo"})
