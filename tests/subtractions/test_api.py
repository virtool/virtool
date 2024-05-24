import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from virtool_core.models.enums import Permission

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.config import get_config_from_app
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.models import SQLSubtractionFile
from virtool.uploads.models import SQLUpload


async def test_find_empty_subtractions(
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/subtractions")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("per_page,page", [(None, None), (2, 1), (2, 2)])
async def test_find(
    page: int | None,
    per_page: int | None,
    fake2: DataFaker,
    snapshot,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    await mongo.subtraction.insert_many(
        [
            {
                "_id": f"id_{number}",
                "created_at": static_time.datetime,
                "file": {
                    "id": 642,
                    "name": f"Apis_mellifera.{number}.fa.gz",
                },
                "has_file": True,
                "name": f"Test {number}",
                "nickname": "",
                "deleted": False,
                "ready": True,
                "user": {"id": user.id},
                "job": {"id": job.id},
            }
            for number in range(5)
        ],
        session=None,
    )

    query = []
    path = "/subtractions"

    if per_page is not None:
        query.append(f"per_page={per_page}")

    if page is not None:
        query.append(f"page={page}")
        path += f"?{'&'.join(query)}"

    resp = await client.get(path)

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_get(
    fake2: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    snapshot,
    static_time,
):
    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    client = await spawn_client(authenticated=True)

    await mongo.subtraction.insert_one(
        {
            "_id": "apple",
            "count": 11,
            "created_at": static_time.datetime,
            "file": {
                "id": 642,
                "name": "Apis_mellifera.1.fa.gz",
            },
            "gc": {"a": 0.21, "t": 0.26, "g": 0.19, "c": 0.29, "n": 0.2},
            "name": "Malus domestica",
            "nickname": "Apple",
            "ready": True,
            "user": {"id": user.id},
            "job": {"id": job.id},
        },
    )

    resp = await client.get("/subtractions/apple")

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_get_from_job(fake, spawn_job_client, snapshot):
    client = await spawn_job_client(authenticated=True)

    subtraction = await fake.subtractions.insert()

    resp = await client.get(f"/subtractions/{subtraction['_id']}")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "data",
    [
        {"name": "Bar"},
        {"nickname": "Bar Subtraction"},
        {"nickname": ""},
        {"name": "Bar", "nickname": "Bar Subtraction"},
    ],
)
@pytest.mark.parametrize("has_user", [True, False])
@pytest.mark.parametrize("has_job", [True, False])
async def test_edit(
    data: dict,
    has_job: bool,
    has_user: bool,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    user = await fake2.users.create()

    await mongo.samples.insert_many(
        [
            {"_id": "12", "name": "Sample 12", "subtractions": ["apple"]},
            {"_id": "22", "name": "Sample 22", "subtractions": ["apple"]},
        ],
        session=None,
    )

    document = {
        "_id": "apple",
        "count": 11,
        "created_at": static_time.datetime,
        "file": {
            "id": 642,
            "name": "Apis_mellifera.1.fa.gz",
        },
        "gc": {"a": 0.21, "t": 0.26, "g": 0.19, "c": 0.29, "n": 0.2},
        "name": "Malus domestica",
        "nickname": "Apple",
        "ready": True,
        "user": None,
    }

    if has_user:
        document["user"] = {"id": user.id}

    if has_job:
        job = await fake2.jobs.create(user)
        document["job"] = {"id": job.id}

    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.modify_subtraction],
    )

    await mongo.subtraction.insert_one(document)

    resp = await client.patch("/subtractions/apple", data)

    assert resp.status == 200
    assert await resp.json() == snapshot
    assert await mongo.subtraction.find_one() == snapshot


@pytest.mark.parametrize("exists", [True, False])
async def test_delete(
    exists: bool,
    fake2: DataFaker,
    resp_is,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    tmp_path,
):
    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.modify_subtraction],
    )

    get_config_from_app(client.app).data_path = tmp_path

    if exists:
        user = await fake2.users.create()
        job = await fake2.jobs.create(user)

        await mongo.subtraction.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "deleted": False,
                "ready": False,
                "nickname": "Foo Subtraction",
                "user": {"id": user.id},
                "job": {"id": job.id},
            },
        )

    resp = await client.delete("subtractions/foo")

    assert resp.status == 204 if exists else 400


@pytest.mark.parametrize("error", [None, "404_name", "404", "409"])
async def test_upload(
    error: str | None,
    pg: AsyncEngine,
    resp_is,
    mongo: Mongo,
    spawn_job_client,
    snapshot,
    tmp_path: Path,
):
    client = await spawn_job_client(authenticated=True)
    test_dir = tmp_path / "files"
    test_dir.mkdir()
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    get_config_from_app(client.app).data_path = tmp_path

    if error == "409":
        async with AsyncSession(pg) as session:
            session.add(SQLSubtractionFile(name="subtraction.1.bt2", subtraction="foo"))
            await session.commit()

    if error != "404":
        await mongo.subtraction.insert_one({"_id": "foo", "name": "Foo"})

    url = "/subtractions/foo/files"

    if error == "404_name":
        url = f"{url}/reference.1.bt2"
    else:
        url = f"{url}/subtraction.1.bt2"

    resp = await client.put(
        url,
        data={"file": open(test_dir / "subtraction.1.bt2", "rb")},
    )

    match error:
        case None:
            assert resp.status == 201
            assert await resp.json() == snapshot
            assert os.listdir(tmp_path / "subtractions" / "foo") == [
                "subtraction.1.bt2",
            ]
        case "404_name":
            await resp_is.not_found(resp, "Unsupported subtraction file name")
        case "404":
            await resp_is.not_found(resp)
        case "409":
            await resp_is.conflict(resp, "File name already exists")


@pytest.mark.parametrize("error", [None, "404", "409", "422"])
async def test_finalize(
    error: str | None,
    fake2,
    snapshot,
    mongo: Mongo,
    spawn_job_client,
    resp_is,
    static_time,
    test_subtraction_files,
):
    client = await spawn_job_client(authenticated=True)

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    document = {
        "_id": "foo",
        "created_at": static_time.datetime,
        "file": {
            "id": 642,
            "name": "Apis_mellifera.1.fa.gz",
        },
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "user": {"id": user.id},
        "job": {"id": job.id},
    }

    if error == "409":
        document["ready"] = True

    if error != "404":
        await mongo.subtraction.insert_one(document)

    data = {}

    if error != "422":
        data = {
            "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
            "count": 100,
        }

    resp = await client.patch("/subtractions/foo", json=data)

    match error:
        case None:
            assert resp.status == 200
            assert await resp.json() == snapshot
            assert await mongo.subtraction.find_one() == snapshot
        case "404":
            await resp_is.not_found(resp)
        case "409":
            await resp_is.conflict(resp, "Subtraction has already been finalized")
        case "422":
            await resp_is.invalid_input(
                resp,
                {"gc": ["required field"], "count": ["required field"]},
            )


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_job_remove(
    exists: bool,
    ready: bool,
    fake2: DataFaker,
    resp_is,
    snapshot,
    mongo: Mongo,
    spawn_job_client: JobClientSpawner,
    static_time,
    tmp_path: Path,
):
    client = await spawn_job_client(authenticated=True)

    get_config_from_app(client.app).data_path = tmp_path

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    if exists:
        await asyncio.gather(
            mongo.subtraction.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "file": {
                        "id": 642,
                        "name": "Apis_mellifera.1.fa.gz",
                    },
                    "name": "Foo",
                    "nickname": "Foo Subtraction",
                    "deleted": False,
                    "ready": ready,
                    "user": {"id": user.id},
                    "job": {"job": job.id},
                },
            ),
            mongo.samples.insert_one(
                {"_id": "test", "name": "Test", "subtractions": ["foo"]},
            ),
        )

    resp = await client.delete("/subtractions/foo")

    if not exists:
        assert resp.status == 404
    elif ready:
        await resp_is.conflict(resp, "Only unfinalized subtractions can be deleted")
        return
    else:
        await resp_is.no_content(resp)
        assert await mongo.subtraction.find_one("foo") == snapshot
        assert await mongo.samples.find_one("test") == snapshot


@pytest.mark.parametrize("error", [None, "400_subtraction", "400_file", "400_path"])
async def test_download_subtraction_files(
    error,
    mongo,
    pg: AsyncEngine,
    spawn_job_client,
    tmp_path,
):
    client = await spawn_job_client(authenticated=True)

    get_config_from_app(client.app).data_path = tmp_path

    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)

    if error != "400_path":
        test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
        test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    if error != "400_subtraction":
        await mongo.subtraction.insert_one({"_id": "foo", "name": "Foo"})

    if error != "400_file":
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLSubtractionFile(
                        id=1,
                        name="subtraction.fa.gz",
                        subtraction="foo",
                        type="fasta",
                    ),
                    SQLSubtractionFile(
                        id=2,
                        name="subtraction.1.bt2",
                        subtraction="foo",
                        type="bowtie2",
                    ),
                ],
            )
            await session.commit()

    fasta_resp = await client.get("/subtractions/foo/files/subtraction.fa.gz")
    bowtie_resp = await client.get("/subtractions/foo/files/subtraction.1.bt2")

    if not error:
        assert fasta_resp.status == bowtie_resp.status == 200
    else:
        assert fasta_resp.status == bowtie_resp.status == 404
        return

    path = get_config_from_app(client.app).data_path / "subtractions" / "foo"

    assert (path / "subtraction.fa.gz").read_bytes() == await fasta_resp.content.read()
    assert (path / "subtraction.1.bt2").read_bytes() == await bowtie_resp.content.read()


async def test_create(
    fake2,
    pg,
    mongo: Mongo,
    spawn_client,
    mocker,
    snapshot,
    static_time,
):
    user = await fake2.users.create()

    async with AsyncSession(pg) as session:
        upload = SQLUpload(
            created_at=static_time.datetime,
            name="palm.fa.gz",
            name_on_disk="1-palm.fa.gz",
            ready=True,
            removed=False,
            reserved=False,
            size=12345,
            type="subtraction",
            user=user.id,
            uploaded_at=static_time.datetime,
        )

        session.add(upload)

        await session.flush()

        upload_id = upload.id

        await session.commit()

    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")

    client = await spawn_client(
        authenticated=True,
        base_url="https://virtool.example.com",
        permissions=[Permission.modify_subtraction],
    )

    resp = await client.post(
        "/subtractions",
        {"name": "Calamus", "nickname": "Rim Palm", "upload_id": upload_id},
    )

    assert resp.status == 201
    assert await resp.json() == snapshot
    assert await mongo.jobs.find_one() == snapshot(name="job")
