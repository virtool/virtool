import asyncio
import datetime
import shutil
from pathlib import Path

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.fake.next import fake_file_chunker, DataFaker
from virtool.pg.utils import get_row_by_id
from virtool.references.db import get_manifest
from virtool.references.tasks import (
    CleanReferencesTask,
    ImportReferenceTask,
    RemoteReferenceTask,
    CloneReferenceTask,
)
from virtool.tasks.models import SQLTask
from virtool.uploads.models import UploadType
from virtool.utils import get_temp_dir

TEST_FILES_PATH = Path(__file__).parent.parent / "test_files"


@pytest.mark.parametrize(
    "update",
    [
        None,
        {"name": "v1.2.0", "ready": True},
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
    update, data_layer, fake2, mocker, mongo, pg, snapshot, static_time
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

    task = SQLTask(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="clean_timed_out_updates",
        type="clean_references",
        created_at=static_time.datetime,
    )

    user = await fake2.users.create()

    if update:
        updates = [
            {
                **update,
                "body": "## Changelog\n\n### v1.2.2\n\n* Foo\n* Bar\n",
                "filename": "CHANGELOG.md",
                "html_url": "https://example.com",
                "id": 1123456,
                "newer": True,
                "published_at": datetime.datetime(2020, 1, 1, 21, 0, 0),
                "size": 1234567,
                "user": {"id": user.id},
            }
        ]
    else:
        updates = []

    await mongo.references.insert_one(
        {
            "_id": "foo",
            "created_at": datetime.datetime(2020, 1, 1, 21, 0, 0),
            "data_type": "genome",
            "description": "",
            "groups": [],
            "organism": "",
            "installed": {"name": "v1.2.1"},
            "name": "Foo",
            "remotes_from": {"slug": "virtool/ref-plant-viruses", "errors": []},
            "restrict_source_types": False,
            "source_types": ["isolate"],
            "updates": updates,
            "updating": True,
            "user": {
                "id": user.id,
            },
        }
    )

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    task = CleanReferencesTask(1, data_layer, {}, get_temp_dir())
    await task.run()

    task = await get_row_by_id(pg, SQLTask, 1)

    assert task.complete is True
    assert task.progress == 100

    assert await mongo.references.find_one({}) == snapshot


@pytest.fixture
def assert_reference_created(mongo, snapshot):
    async def func(
        query: dict | None = None,
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
    config,
    data_layer: DataLayer,
    fake2,
    mongo,
    pg,
    static_time,
    tmpdir,
):
    user = await fake2.users.create()

    upload = await data_layer.uploads.create(
        fake_file_chunker(TEST_FILES_PATH / "reference.json.gz"),
        "import.json.gz",
        UploadType.reference,
        user.id,
    )

    await mongo.references.insert_one(
        {
            "_id": "foo",
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "A test reference",
            "internal_control": None,
            "user": {
                "id": user.id,
            },
        }
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={
                    "path": str(config.data_path / "files" / upload.name_on_disk),
                    "ref_id": "foo",
                    "user_id": user.id,
                },
                count=0,
                progress=0,
                step="load_file",
                type="import_reference",
                created_at=static_time.datetime,
            )
        )

        await session.commit()

    task = await ImportReferenceTask.from_task_id(data_layer, 1)

    await task.run()
    await assert_reference_created()


async def test_remote_reference_task(
    assert_reference_created,
    data_layer,
    mocker,
    mongo,
    pg,
    static_time,
    tmpdir,
):
    async def download_file(url, target_path, _):
        shutil.copyfile(TEST_FILES_PATH / "reference.json.gz", target_path)

    mocker.patch("virtool.references.tasks.download_file", download_file)

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
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
async def create_reference(
    fake2: DataFaker,
    data_layer: DataLayer,
    mongo,
    pg,
    static_time,
    tmpdir,
):
    user = await fake2.users.create()

    upload = await data_layer.uploads.create(
        fake_file_chunker(TEST_FILES_PATH / "reference.json.gz"),
        "import.json.gz",
        UploadType.reference,
        user.id,
    )

    path = tmpdir / "files" / upload.name_on_disk

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=2,
                complete=False,
                context={
                    "path": str(path),
                    "ref_id": "bar",
                    "user_id": "test",
                },
                count=0,
                created_at=static_time.datetime,
                progress=0,
                step="load_file",
                type="import_reference",
            )
        )

        await asyncio.gather(
            session.commit(),
            mongo.references.insert_one(
                {
                    "_id": "bar",
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
                }
            ),
        )

    task = await ImportReferenceTask.from_task_id(data_layer, 2)
    await task.run()

    return "bar"


@pytest.mark.flaky(reruns=2)
async def test_clone_reference_task(
    assert_reference_created,
    create_reference: str,
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo,
    pg: AsyncEngine,
    static_time,
    tmpdir,
):
    manifest = await get_manifest(mongo, create_reference)

    user = await fake2.users.create()

    await mongo.references.insert_one(
        {
            "_id": "foo",
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "A test reference",
            "internal_control": None,
            "groups": [],
            "name": "Test",
            "organism": "virus",
            "restrict_source_types": False,
            "source_types": [],
            "user": {
                "id": user.id,
            },
            "users": [],
        }
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
            )
        )

        await session.commit()

    task = await CloneReferenceTask.from_task_id(data_layer, 1)
    await task.run()

    row = await get_row_by_id(pg, SQLTask, 1)
    assert row.complete is True

    await assert_reference_created(query={"reference.id": "foo"})
