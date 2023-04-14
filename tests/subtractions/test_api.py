import asyncio
import os

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.enums import Permission

from virtool.subtractions.models import SQLSubtractionFile
from virtool.uploads.models import Upload


@pytest.mark.apitest
async def test_find_empty_subtractions(fake2, spawn_client, snapshot, static_time):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/subtractions")

    assert resp.status == 200
    assert await resp.json() == snapshot

@pytest.mark.parametrize("per_page,page", [(None, None), (2, 1), (2, 2)])
@pytest.mark.apitest
async def test_find(fake2, spawn_client, snapshot, static_time, per_page, page):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    await client.db.subtraction.insert_many(
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
                "job": {"id": job.id}
            }
            for number in range(0, 5)
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


@pytest.mark.apitest
async def test_get(fake2, spawn_client, static_time, snapshot):
    user = await fake2.users.create()

    job = await fake2.jobs.create(user)

    client = await spawn_client(authorize=True)

    subtraction = {
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
        "job": {"id": job.id}
    }

    await client.db.subtraction.insert_one(subtraction)

    resp = await client.get(f"/subtractions/{subtraction['_id']}")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_get_from_job(fake, spawn_job_client, snapshot):
    client = await spawn_job_client(authorize=True)

    subtraction = await fake.subtractions.insert()

    resp = await client.get(f"/subtractions/{subtraction['_id']}")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
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
async def test_edit(data, fake2, has_user, has_job, mocker, snapshot, spawn_client, static_time):
    mocker.patch(
        "virtool.subtractions.db.get_linked_samples",
        make_mocked_coro(
            [{"id": "12", "name": "Sample 12"}, {"id": "22", "name": "Sample 22"}]
        ),
    )

    user = await fake2.users.create()

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
    }

    if has_user:
        document["user"] = {"id": user.id}

    if has_job:
        job = await fake2.jobs.create(user)
        document["job"] = {"id": job.id}

    client = await spawn_client(
        authorize=True, permissions=[Permission.modify_subtraction]
    )

    await client.db.subtraction.insert_one(document)

    resp = await client.patch("/subtractions/apple", data)

    assert resp.status == 200

    test_resp = await resp.json()

    assert test_resp == snapshot

    assert await client.db.subtraction.find_one() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("exists", [True, False])
async def test_delete(exists, fake2, spawn_client, tmp_path, resp_is):
    client = await spawn_client(
        authorize=True, permissions=[Permission.modify_subtraction]
    )
    client.app["config"].data_path = tmp_path

    if exists:
        user = await fake2.users.create()
        job = await fake2.jobs.create(user)

        await client.db.subtraction.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "deleted": False,
                "ready": False,
                "nickname": "Foo Subtraction",
                "user": {"id": user.id},
                "job": {"id": job.id}
            }
        )

    resp = await client.delete("subtractions/foo")

    assert resp.status == 204 if exists else 400


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404_name", "404", "409"])
async def test_upload(
        error, tmp_path, spawn_job_client, snapshot, resp_is, pg: AsyncEngine
):
    client = await spawn_job_client(authorize=True)
    test_dir = tmp_path / "files"
    test_dir.mkdir()
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")
    path = test_dir / "subtraction.1.bt2"

    files = {"file": open(path, "rb")}

    client.app["config"].data_path = tmp_path

    subtraction = {"_id": "foo", "name": "Foo"}

    if error == "409":
        async with AsyncSession(pg) as session:
            session.add(SQLSubtractionFile(name="subtraction.1.bt2", subtraction="foo"))
            await session.commit()

    await client.db.subtraction.insert_one(subtraction)

    url = "/subtractions/foo/files"

    if error == "404_name":
        url += "/reference.1.bt2"
    else:
        url += "/subtraction.1.bt2"

    resp = await client.put(url, data=files)

    if error == "404_name":
        await resp_is.not_found(resp, "Unsupported subtraction file name")
        return

    if error == "409":
        await resp_is.conflict(resp, "File name already exists")
        return

    assert resp.status == 201
    assert await resp.json() == snapshot
    assert os.listdir(tmp_path / "subtractions" / "foo") == ["subtraction.1.bt2"]


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404", "409", "422"])
async def test_finalize_subtraction(
        error,
        fake2,
        spawn_job_client,
        snapshot,
        resp_is,
        test_subtraction_files,
        static_time,
):
    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    subtraction = {
        "_id": "foo",
        "created_at": static_time.datetime,
        "file": {
            "id": 642,
            "name": "Apis_mellifera.1.fa.gz",
        },
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "user": {"id": user.id},
        "job": {"id": job.id}
    }

    data = {
        "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
        "count": 100,
    }

    client = await spawn_job_client(authorize=True)

    if error == "409":
        subtraction["ready"] = True

    if error == "422":
        data = {}

    if error != "404":
        await client.db.subtraction.insert_one(subtraction)

    resp = await client.patch("/subtractions/foo", json=data)

    if error == "404":
        await resp_is.not_found(resp)
        return

    if error == "409":
        await resp_is.conflict(resp, "Subtraction has already been finalized")
        return

    if error == "422":
        await resp_is.invalid_input(
            resp, {"gc": ["required field"], "count": ["required field"]}
        )
        return

    assert resp.status == 200
    assert await resp.json() == snapshot
    assert await client.db.subtraction.find_one("foo") == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_job_remove(
        exists, fake2, ready, tmp_path, spawn_job_client, snapshot, resp_is, static_time
):
    client = await spawn_job_client(authorize=True)
    client.app["config"].data_path = tmp_path

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

    if exists:
        await asyncio.gather(
            client.db.subtraction.insert_one(
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
                    "job": {"job": job.id}
                }
            ),
            client.db.samples.insert_one(
                {"_id": "test", "name": "Test", "subtractions": ["foo"]}
            ),
        )

    resp = await client.delete("/subtractions/foo")

    if not exists:
        assert resp.status == 404
        return

    if ready:
        await resp_is.conflict(resp, "Only unfinalized subtractions can be deleted")
        return

    await resp_is.no_content(resp)
    assert await client.db.subtraction.find_one("foo") == snapshot
    assert await client.db.samples.find_one("test") == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400_subtraction", "400_file", "400_path"])
async def test_download_subtraction_files(
        error, tmp_path, spawn_job_client, pg: AsyncEngine
):
    client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path

    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)

    if error != "400_path":
        test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
        test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    subtraction = {"_id": "foo", "name": "Foo"}

    if error != "400_subtraction":
        await client.db.subtraction.insert_one(subtraction)

    file_1 = SQLSubtractionFile(
        id=1, name="subtraction.fa.gz", subtraction="foo", type="fasta"
    )

    file_2 = SQLSubtractionFile(
        id=2, name="subtraction.1.bt2", subtraction="foo", type="bowtie2"
    )

    if error != "400_file":
        async with AsyncSession(pg) as session:
            session.add_all([file_1, file_2])
            await session.commit()

    fasta_resp = await client.get("/subtractions/foo/files/subtraction.fa.gz")
    bowtie_resp = await client.get("/subtractions/foo/files/subtraction.1.bt2")

    if not error:
        assert fasta_resp.status == bowtie_resp.status == 200
    else:
        assert fasta_resp.status == bowtie_resp.status == 404
        return

    fasta_expected_path = (
            client.app["config"].data_path / "subtractions" / "foo" / "subtraction.fa.gz"
    )
    bowtie_expected_path = (
            client.app["config"].data_path / "subtractions" / "foo" / "subtraction.1.bt2"
    )

    assert fasta_expected_path.read_bytes() == await fasta_resp.content.read()
    assert bowtie_expected_path.read_bytes() == await bowtie_resp.content.read()


@pytest.mark.apitest
async def test_create(fake2, pg, spawn_client, mocker, snapshot, static_time):
    user = await fake2.users.create()

    async with AsyncSession(pg) as session:
        upload = Upload(
            created_at=static_time.datetime,
            name="palm.fa.gz",
            name_on_disk="1-palm.fa.gz",
            ready=True,
            removed=False,
            reserved=False,
            size=12345,
            type="subtraction",
            user=user.id,
            uploaded_at=static_time.datetime
        )

        session.add(upload)

        await session.flush()

        upload_id = upload.id

        await session.commit()

    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")

    client = await spawn_client(
        authorize=True,
        base_url="https://virtool.example.com",
        permissions=Permission.modify_subtraction.value,
    )

    data = {"name": "Calamus", "nickname": "Rim Palm", "upload_id": upload_id}

    resp = await client.post("/subtractions", data)

    assert resp.status == 201

    assert await resp.json() == snapshot

    assert await client.db.jobs.find_one() == snapshot(name="job")
