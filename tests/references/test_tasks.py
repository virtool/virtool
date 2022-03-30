import datetime
import shutil
from pathlib import Path

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy.matchers import path_type

import virtool.uploads.db
from virtool.references.tasks import CleanReferencesTask, ImportReferenceTask
from virtool.tasks.models import Task
from virtool.uploads.models import UploadType

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
    update, dbi, mocker, pg, snapshot, spawn_client, static_time
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

    client = await spawn_client(authorize=True)

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

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    updates = []

    if update:
        updates.append(update)

    await dbi.references.insert_one(
        {
            "_id": "foo",
            "updates": updates,
            "installed": {"name": "v1.2.1"},
            "updating": True,
            "remotes_from": {"slug": "virtool/ref-plant-viruses"},
        }
    )

    clean_references_task = CleanReferencesTask(client.app, 1)
    await clean_references_task.run()

    assert await dbi.references.find_one({}) == snapshot


async def test_import_reference_task(snapshot, spawn_client, pg, static_time, tmpdir):
    client = await spawn_client(authorize=True)

    path = Path(tmpdir.mkdir("files")) / "reference.json.gz"
    shutil.copyfile(TEST_FILES_PATH / "reference.json.gz", path)

    await virtool.uploads.db.create(
        pg, "import.json.gz", UploadType.reference, False, "test"
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
        await session.commit()

    await client.db.references.insert_one(
        {
            "_id": "foo",
            "created_at": static_time.datetime,
        }
    )

    import_reference_task = ImportReferenceTask(client.app, 1)
    await import_reference_task.run()

    assert await client.db.references.find_one({"_id": "foo"}) == snapshot(name="ref")

    assert await client.db.otus.find({}, sort=[("name", 1)]).to_list(None) == snapshot(
        name="otus",
        matcher=path_type(
            {".*_id": (str,), ".*created_at": (datetime.datetime,)},
            regex=True,
        ),
    )

    assert await client.db.sequences.find({}, sort=[("accession", 1)]).to_list(
        None
    ) == snapshot(
        name="sequences",
        matcher=path_type(
            {
                ".*_id": (str,),
            },
            regex=True,
        ),
    )

    assert await client.db.history.find({}, sort=[("otu.name", 1)]).to_list(
        None
    ) == snapshot(
        name="history",
        matcher=path_type({".*_id": (str,), ".*otu.id": (str,)}, regex=True),
    )
