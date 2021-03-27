import os
from pathlib import Path

import aiohttp.test_utils
import pytest

from virtool.subtractions.models import SubtractionFile


@pytest.mark.parametrize("data", [
    {"name": "Bar"},
    {"nickname": "Bar Subtraction"},
    {"nickname": ""},
    {"name": "Bar", "nickname": "Bar Subtraction"}
])
async def test_edit(data, mocker, snapshot, spawn_client):
    mocker.patch("virtool.subtractions.db.get_linked_samples", aiohttp.test_utils.make_mocked_coro(12))

    client = await spawn_client(authorize=True, permissions=["modify_subtraction"])

    await client.db.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction"
    })

    resp = await client.patch("/api/subtractions/foo", data)

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")
    snapshot.assert_match(await client.db.subtraction.find_one(), "db")


@pytest.mark.parametrize("error", [None, "400_exists", "400_name", "404", "422"])
async def test_upload(error, tmpdir, spawn_job_client, snapshot, resp_is, pg_session):
    client = await spawn_job_client(authorize=True)
    test_dir = tmpdir.mkdir("files")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")
    path = os.path.join(test_dir, "subtraction.1.bt2")

    files = {
        "file": open(path, "rb")
    }

    client.app["settings"]["data_path"] = str(tmpdir)

    subtraction = {
        "_id": "foo",
        "name": "Foo"
    }

    if error == "400_exists":
        subtraction["files"] = [1]

    await client.db.subtraction.insert_one(subtraction)

    url = "/api/subtractions/foo/files"

    if error == "422":
        url += "?type=fasta"
    elif error == "400_name":
        url += "?name=reference.1.bt2"
    else:
        url += "?name=subtraction.1.bt2"

    resp = await client.post(url, data=files)

    if error == "400_name":
        assert await resp_is.bad_request(resp, "Unsupported subtraction file name")
        return

    if error == "400_exists":
        assert await resp_is.bad_request(resp, "File name already exists")
        return

    if error == "422":
        assert await resp_is.invalid_query(resp, {'name': ['required field']})
        return

    assert resp.status == 201
    assert os.listdir(tmpdir / "subtractions" / "foo") == ["subtraction.1.bt2"]
    snapshot.assert_match(await resp.json())
    document = await client.db.subtraction.find_one("foo")
    assert document == {
        '_id': 'foo',
        'name': 'Foo',
        'files': [1]
    }


@pytest.mark.parametrize("error", [None, "404", "409", "422"])
async def test_finalize_subtraction(error, spawn_job_client, snapshot, resp_is):
    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction"
    }

    data = {
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        }
    }

    client = await spawn_job_client(authorize=True)

    if error == "409":
        subtraction["ready"] = True

    if error == "422":
        data = {}

    if error != "404":
        await client.db.subtraction.insert_one(subtraction)

    resp = await client.patch("/api/subtractions/foo", json=data)

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if error == "409":
        assert await resp_is.conflict(resp, "Subtraction has already been finalized")
        return

    if error == "422":
        assert await resp_is.invalid_input(resp, {'gc': ['required field']})
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json())
    document = await client.db.subtraction.find_one("foo")
    assert document == {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        },
        "ready": True
    }


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_job_remove(exists, ready, tmpdir, spawn_job_client, snapshot, resp_is):
    client = await spawn_job_client(authorize=True)
    client.app["settings"]["data_path"] = str(tmpdir)

    if exists:
        await client.db.subtraction.insert_one({
            "_id": "foo",
            "name": "Foo",
            "nickname": "Foo Subtraction",
            "deleted": False,
            "ready": ready
        })

        await client.db.samples.insert_one({
            "_id": "test",
            "name": "Test",
            "subtractions": ["foo"]
        })

    resp = await client.delete("/api/subtractions/foo")

    if not exists:
        assert resp.status == 404
        return

    if ready:
        assert await resp_is.conflict(resp, "Only unfinalized subtractions can be deleted")
        return

    assert await resp_is.no_content(resp)

    snapshot.assert_match(await client.db.subtraction.find_one("foo"))
    snapshot.assert_match(await client.db.samples.find_one("test"))


@pytest.mark.parametrize("error", [None, "400_subtraction", "400_file", "400_path"])
async def test_download_subtraction_files(error, tmpdir, spawn_job_client, pg_session):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")

    if error != "400_path":
        test_dir.join("subtraction.fa.gz").write("FASTA file")
        test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    subtraction = {
        "_id": "foo",
        "name": "Foo"
    }

    if error != "400_subtraction":
        await client.db.subtraction.insert_one(subtraction)

    file_1 = SubtractionFile(
        id=1,
        name="subtraction.fa.gz",
        subtraction="foo",
        type="fasta"
    )

    file_2 = SubtractionFile(
        id=2,
        name="subtraction.1.bt2",
        subtraction="foo",
        type="bowtie2"
    )

    if error != "400_file":
        async with pg_session as session:
            session.add_all([file_1, file_2])
            await session.commit()

    fasta_resp = await client.get("/api/subtractions/foo/files/subtraction.fa.gz")
    bowtie_resp = await client.get("/api/subtractions/foo/files/subtraction.1.bt2")

    if not error:
        assert fasta_resp.status == bowtie_resp.status == 200
    else:
        assert fasta_resp.status == bowtie_resp.status == 404
        return

    fasta_expected_path = Path(client.app["settings"]["data_path"]) / "subtractions" / "foo" / "subtraction.fa.gz"
    bowtie_expected_path = Path(client.app["settings"]["data_path"]) / "subtractions" / "foo" / "subtraction.1.bt2"

    assert fasta_expected_path.read_bytes() == await fasta_resp.content.read()
    assert bowtie_expected_path.read_bytes() == await bowtie_resp.content.read()
